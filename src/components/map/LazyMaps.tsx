"use client";

import dynamic from "next/dynamic";

// MapLibre needs WebGL and window: load it on the client only, after the page.
export const AmbientMapLazy = dynamic(() => import("./AmbientMap").then((m) => m.AmbientMap), { ssr: false });
