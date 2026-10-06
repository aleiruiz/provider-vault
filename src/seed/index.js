// Starter data. Uses src/seed/private.js (gitignored) when it exists, otherwise the fictional
// demo data. `vite --mode demo` forces the demo data even if a private file is present.

import * as demo from "./demo.js";

const local = import.meta.glob("./private.js", { eager: true });
const source = import.meta.env.MODE === "demo" ? demo : (Object.values(local)[0] ?? demo);

export const { PROJECTS, SEED, SECRETS_SEED, SEED_VERSION } = source;
