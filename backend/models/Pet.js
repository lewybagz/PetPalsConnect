// Pet is a discriminator of the Content base model and is defined, once, in
// Content.js. This file previously redefined the whole schema and tried to call
// `.discriminator()` on a non-existent `ContentSchema` export, which threw at
// require time. It now re-exports the canonical model so the two definitions
// cannot drift apart.
const { Pet } = require("./Content");

module.exports = Pet;
