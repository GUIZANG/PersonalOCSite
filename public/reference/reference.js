console.clear();

import { VFX } from "https://esm.sh/@vfx-js/core";
const vfx = new VFX();
vfx.add(document.getElementById("img"), { shader: "rgbShift", overflow: 100 });