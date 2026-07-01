/**
 * HalftoneBackground — the signature SlipStream onboarding backdrop: a faint
 * grid of dots over a black field, lit from behind by soft colored glows.
 *
 * Rendered as a single SVG (one tiled <Pattern> for the dots + a couple of
 * radial-gradient blobs), so it stays cheap regardless of dot count.
 */
import { memo } from "react";
import { StyleSheet, useWindowDimensions, View } from "react-native";
import Svg, {
  Circle,
  Defs,
  Pattern,
  RadialGradient,
  Rect,
  Stop,
} from "react-native-svg";

export interface Glow {
  /** Center as a 0–1 fraction of width/height. */
  x: number;
  y: number;
  /** Radius as a fraction of the screen's larger dimension. */
  radius: number;
  color: string;
  /** Peak opacity at the center (0–1). */
  opacity?: number;
}

interface HalftoneBackgroundProps {
  glows?: Glow[];
  /** Dot grid spacing in px. */
  spacing?: number;
  /** Dot color (kept faint). */
  dotColor?: string;
  dotOpacity?: number;
}

export const HalftoneBackground = memo(function HalftoneBackground({
  glows = DEFAULT_GLOWS,
  spacing = 15,
  dotColor = "#FFFFFF",
  dotOpacity = 0.09,
}: HalftoneBackgroundProps) {
  const { width, height } = useWindowDimensions();
  const major = Math.max(width, height);

  return (
    <View style={styles.fill} pointerEvents="none">
      <Svg width={width} height={height} style={StyleSheet.absoluteFill}>
        <Defs>
          <Pattern
            id="dots"
            width={spacing}
            height={spacing}
            patternUnits="userSpaceOnUse"
          >
            <Circle
              cx={spacing / 2}
              cy={spacing / 2}
              r={1}
              fill={dotColor}
              opacity={dotOpacity}
            />
          </Pattern>

          {glows.map((g, i) => (
            <RadialGradient
              key={i}
              id={`glow-${i}`}
              cx="50%"
              cy="50%"
              r="50%"
            >
              <Stop offset="0%" stopColor={g.color} stopOpacity={g.opacity ?? 0.5} />
              <Stop offset="60%" stopColor={g.color} stopOpacity={(g.opacity ?? 0.5) * 0.25} />
              <Stop offset="100%" stopColor={g.color} stopOpacity={0} />
            </RadialGradient>
          ))}

          {/* Vignette to fade the dots toward the edges. */}
          <RadialGradient id="vignette" cx="50%" cy="42%" r="75%">
            <Stop offset="55%" stopColor="#000000" stopOpacity={0} />
            <Stop offset="100%" stopColor="#000000" stopOpacity={0.9} />
          </RadialGradient>
        </Defs>

        {/* Base */}
        <Rect x={0} y={0} width={width} height={height} fill="#000000" />

        {/* Colored glows sit beneath the dots */}
        {glows.map((g, i) => {
          const r = g.radius * major;
          return (
            <Rect
              key={i}
              x={g.x * width - r}
              y={g.y * height - r}
              width={r * 2}
              height={r * 2}
              fill={`url(#glow-${i})`}
            />
          );
        })}

        {/* Dot grid */}
        <Rect x={0} y={0} width={width} height={height} fill="url(#dots)" />

        {/* Edge fade */}
        <Rect x={0} y={0} width={width} height={height} fill="url(#vignette)" />
      </Svg>
    </View>
  );
});

const DEFAULT_GLOWS: Glow[] = [
  { x: 0.5, y: 0.45, radius: 0.5, color: "#2D6CFF", opacity: 0.35 },
];

const styles = StyleSheet.create({
  fill: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "#000",
  },
});
