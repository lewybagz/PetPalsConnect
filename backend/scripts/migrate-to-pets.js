#!/usr/bin/env node
/**
 * Moves conversations and friendships onto the pets they are actually about.
 *
 *   node scripts/migrate-to-pets.js --dry-run
 *   node scripts/migrate-to-pets.js
 *
 * Safe to run repeatedly: every step is idempotent and skips rows that already
 * carry their pets.
 *
 * Three changes need backfilling.
 *
 * **Chats** were keyed by the sorted pair of *owner* ids and carried a single
 * `petId` - whichever pet the caller tapped to open the thread. They are now
 * keyed by the sorted pair of *pet* ids and carry both. The old `petId` gives
 * one side; the other is that participant's first pet, which is the best
 * available guess and is right for the overwhelming majority of households,
 * since a second pet is the thing that made the old key ambiguous in the first
 * place.
 *
 * **Friendships** and **friend requests** were person-to-person. Each side's
 * first pet is filled in, for the same reason.
 *
 * A chat whose pets cannot be resolved - a deleted pet, an owner with none -
 * is left exactly as it is rather than being given a wrong key or dropped. It
 * keeps working: `getUserChats` filters on participants, not on the key.
 */

const fs = require("node:fs");
const path = require("node:path");
const { createHash } = require("node:crypto");

const SHA256 = (value) => createHash("sha256").update(String(value)).digest("hex");

const ROOT = path.resolve(__dirname, "..");

/**
 * Decodes a .env that may not be UTF-8. PowerShell's `>` redirection and
 * `Set-Content` before PowerShell 6 write UTF-16LE, which read as UTF-8 is a
 * NUL between every letter - so `MONGODB_URI=` matches nothing and the file
 * looks empty to a parser that never says why.
 */
const decodeEnv = (buffer) => {
  if (buffer[0] === 0xff && buffer[1] === 0xfe) return buffer.subarray(2).toString("utf16le");
  if (buffer[0] === 0xfe && buffer[1] === 0xff) return buffer.subarray(2).swap16().toString("utf16le");
  // No BOM, but UTF-16LE ASCII still puts a NUL in every second byte.
  if (buffer.length > 1 && buffer[1] === 0x00 && buffer[0] !== 0x00) return buffer.toString("utf16le");
  return buffer.toString("utf8").replace(/^\ufeff/, "");
};

const readMongoUri = () => {
  if (process.env.MONGODB_URI) return { uri: process.env.MONGODB_URI };
  const envFile = path.join(ROOT, ".env");
  if (!fs.existsSync(envFile)) return { error: `No MONGODB_URI in the environment, and no file at ${envFile}.` };

  const text = decodeEnv(fs.readFileSync(envFile));
  for (const line of text.split(/\r?\n/)) {
    const match = line.match(/^\s*(?:export\s+)?MONGODB_URI\s*=\s*(.*)$/);
    if (match) {
      const uri = match[1].trim().replace(/^["']|["']$/g, "");
      if (uri) return { uri };
      return { error: `MONGODB_URI is empty in ${envFile}.` };
    }
  }

  const keys = text
    .split(/\r?\n/)
    .map((line) => line.match(/^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=/))
    .filter(Boolean)
    .map((match) => match[1]);
  return {
    error: keys.length
      ? `No MONGODB_URI in ${envFile}. It defines: ${keys.join(", ")}.`
      : `No MONGODB_URI in ${envFile}, and no settings could be read from it at all - check its encoding is UTF-8.`,
  };
};

const main = async () => {
  const dryRun = process.argv.includes("--dry-run");

  const { uri, error } = readMongoUri();
  if (!uri) {
    console.error(error);
    process.exit(1);
  }

  const mongoose = require("mongoose");
  const Chat = require("../models/Chat");
  const Friend = require("../models/Friend");
  const FriendRequest = require("../models/FriendRequest");
  const Pet = require("../models/Pet");

  await mongoose.connect(uri);
  console.log(`Connected to ${uri.replace(/\/\/[^@]*@/, "//***@")}`);
  if (dryRun) console.log("Dry run: nothing will be written.\n");

  /** owner id -> that owner's first pet id, loaded once. */
  const firstPetByOwner = new Map();
  for (const pet of await Pet.find().select("_id owner").sort({ _id: 1 }).lean()) {
    const owner = String(pet.owner);
    if (owner && !firstPetByOwner.has(owner)) firstPetByOwner.set(owner, String(pet._id));
  }
  console.log(`${firstPetByOwner.size} owners with at least one pet.`);

  const petOwner = new Map(
    (await Pet.find().select("_id owner").lean()).map((pet) => [
      String(pet._id),
      String(pet.owner),
    ])
  );

  // --- Chats -------------------------------------------------------------
  let chatsDone = 0;
  let chatsSkipped = 0;

  // `petId` is gone from the schema, so these are read and written through the
  // raw collection - Mongoose would strip the field it no longer knows about
  // before we could look at it. The name comes from the model rather than a
  // literal, so a renamed collection cannot leave this silently reading
  // nothing.
  const chats = mongoose.connection.collection(Chat.collection.name);
  const rawChats = await chats.find({}).toArray();

  for (const raw of rawChats) {
    if (Array.isArray(raw.pets) && raw.pets.length === 2) continue;

    const known = raw.petId ? String(raw.petId) : null;
    const participants = (raw.participants ?? []).map(String);

    // The other side is whichever participant does not own the known pet.
    const knownOwner = known ? petOwner.get(known) : null;
    const otherOwner = participants.find((id) => id !== knownOwner);

    const pets = [];
    if (known) pets.push(known);
    const otherPet = otherOwner ? firstPetByOwner.get(otherOwner) : null;
    if (otherPet) pets.push(otherPet);

    // Fall back to both participants' first pets when there was no petId.
    if (pets.length < 2 && !known) {
      pets.length = 0;
      for (const id of participants) {
        const pet = firstPetByOwner.get(id);
        if (pet) pets.push(pet);
      }
    }

    if (pets.length !== 2 || pets[0] === pets[1]) {
      console.warn(`  skip chat ${raw._id}: could not resolve two distinct pets`);
      chatsSkipped += 1;
      continue;
    }

    const sorted = [...pets].sort();
    const chatId = SHA256(sorted.join("-"));

    console.log(`  chat ${raw._id} -> pets ${sorted.join(", ")}`);
    if (!dryRun) {
      await chats.updateOne(
        { _id: raw._id },
        {
          $set: {
            chatId,
            pets: sorted.map((id) => new mongoose.Types.ObjectId(id)),
          },
          $unset: { petId: "" },
        }
      );
    }
    chatsDone += 1;
  }

  // --- Friendships -------------------------------------------------------
  let friendsDone = 0;
  for (const friend of await Friend.find({
    $or: [{ pet1: { $exists: false } }, { pet2: { $exists: false } }],
  })) {
    const pet1 = firstPetByOwner.get(String(friend.user1));
    const pet2 = firstPetByOwner.get(String(friend.user2));
    if (!pet1 && !pet2) continue;

    console.log(`  friendship ${friend._id} -> ${pet1 ?? "?"} + ${pet2 ?? "?"}`);
    if (!dryRun) {
      if (pet1) friend.pet1 = pet1;
      if (pet2) friend.pet2 = pet2;
      await friend.save();
    }
    friendsDone += 1;
  }

  // --- Friend requests ---------------------------------------------------
  let requestsDone = 0;
  for (const request of await FriendRequest.find({
    $or: [{ senderPet: { $exists: false } }, { receiverPet: { $exists: false } }],
  })) {
    const senderPet = firstPetByOwner.get(String(request.sender));
    const receiverPet = firstPetByOwner.get(String(request.receiver));
    if (!senderPet && !receiverPet) continue;

    console.log(`  request ${request._id} -> ${senderPet ?? "?"} -> ${receiverPet ?? "?"}`);
    if (!dryRun) {
      if (senderPet) request.senderPet = senderPet;
      if (receiverPet) request.receiverPet = receiverPet;
      await request.save();
    }
    requestsDone += 1;
  }

  console.log(
    `\n${chatsDone} chats re-keyed (${chatsSkipped} left alone), ` +
      `${friendsDone} friendships and ${requestsDone} requests given their pets.`
  );

  return mongoose;
};

// Exported so the decoder can be tested on buffers. A test must never write
// the real backend/.env to exercise it.
module.exports = { decodeEnv, readMongoUri };

if (require.main === module) {
  main()
    .then(async (mongoose) => {
      if (mongoose?.connection?.readyState !== 0) await mongoose.disconnect();
    })
    .catch((error) => {
      console.error(error);
      process.exitCode = 1;
    });
}
