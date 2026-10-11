/**
 * The capture-only IIFE entry: what the host injects for `film --in-app`, where the app's own
 * vendored runtime boots late, after any clock script (`browser.clock.fixed`). It captures the
 * real clocks and setters first, in the top frame; the runtime then finds them already held.
 */
import { captureNatives, isTopFrame } from "./capture.ts";

if (isTopFrame()) captureNatives();
