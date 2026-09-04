# Web stubs

**The app does not ship on web.** These exist so the screens can be rendered in
a headless browser and looked at - which is otherwise impossible on a machine
with no Android SDK, no KVM and no macOS, and which is how the design work in
`src/styles/tokens.ts` and `src/components/ui` gets reviewed by eye rather than
only by test.

`metro.config.js` swaps these in **only when `platform === "web"`**, so an
Android or iOS bundle never sees them. Each one stands in for a module with no
web implementation at all: React Native Firebase, Maps, Stripe's native SDK.

They are deliberately inert. A stub that pretended to sign somebody in would
make the gallery lie about what the screens do.
