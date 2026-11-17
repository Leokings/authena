import { loadFont as loadBricolage } from "@remotion/google-fonts/BricolageGrotesque";
import { loadFont as loadGeist } from "@remotion/google-fonts/Geist";
import { loadFont as loadGeistMono } from "@remotion/google-fonts/GeistMono";
import { Composition } from "remotion";
import { Authena, DURATION, FPS, HEIGHT, WIDTH } from "./Authena";

// The same fonts as the website.
loadBricolage("normal", { weights: ["800"] });
loadGeist("normal", { weights: ["400", "500", "600"] });
loadGeistMono("normal", { weights: ["400", "500"] });

export function RemotionRoot() {
  return <Composition id="Authena" component={Authena} durationInFrames={DURATION} fps={FPS} width={WIDTH} height={HEIGHT} />;
}
