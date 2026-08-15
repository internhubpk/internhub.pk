"use client";

import React from "react";

type TokenType =
  | "keyword"
  | "variable"
  | "plain"
  | "operator"
  | "string"
  | "function"
  | "property"
  | "boolean"
  | "comment"
  | "github";

type Token = [string, TokenType];

const code: Token[][] = [
  [
    ["function ", "keyword"],
    ["startInternship", "function"],
    ["(user) {", "plain"],
  ],
  [
    ["  return ", "keyword"],
    ["createOpportunity", "function"],
    ["({", "plain"],
  ],
  [
    ["    student", "property"],
    [": user,", "plain"],
  ],
  [
    ["    skills", "property"],
    [": user.skills,", "plain"],
  ],
  [
    ["    remote", "property"],
    [": ", "plain"],
    ["true", "boolean"],
  ],
  [
    ["  });", "plain"],
  ],
  [
    ["}", "plain"],
  ],
  [],
  [
    ["const ", "keyword"],
    ["platform", "variable"],
    [" = ", "operator"],
    ['"InternHub"', "string"],
    [";", "plain"],
  ],
  [
    ["await ", "keyword"],
    ["platform.launch", "function"],
    ["();", "plain"],
  ],
  [],
  [
    ["// github.com/", "comment"],
    ["Danyalkhattak", "github"],
  ],
];

const LINE_STEP = 0.42;
const ANIMATION_DURATION = 9.5;

/**
 * DeveloperLaptopHero
 *
 * Animated SVG of a laptop displaying a typed-code editor. Used as the
 * right-side hero visual on the InternHub landing page.
 *
 * Behavior:
 *   - Visible only on `md:` and up (the outer wrapper is `hidden md:block`).
 *   - On `< 768px` the entire SVG is unmounted via the `@media (max-width:
 *     767px) { display: none !important; }` rule AND the Tailwind
 *     `hidden md:block` class. Both prevent layout space and rendering.
 *   - Honors `prefers-reduced-motion`: animations are disabled and the
 *     code is shown statically.
 *   - Pure SVG + CSS — no canvas, no WebGL, no JS animation loop, no
 *     requestAnimationFrame. Very low runtime cost.
 *   - Theme-aware via CSS variables scoped to `.dev-laptop` and
 *     `.dark .dev-laptop`. Both light and dark themes look intentional.
 *   - `pointer-events-none` so it never blocks clicks on underlying
 *     hero content (CTAs, links).
 */
export default function DeveloperLaptopHero() {
  return (
    <div className="hidden w-full md:block" aria-hidden="true">
      <style>{`
        /* =========================================================
           THEME VARIABLES
        ========================================================= */

        .dev-laptop {
          --screen: #f8fafc;
          --toolbar: #eef2f7;
          --sidebar: #f5f7fa;

          --muted: #94a3b8;
          --line-number: #9aa7b5;
          --divider: rgba(15, 23, 42, 0.07);

          --keyword: #7c3aed;
          --variable: #0369a1;
          --function: #0e7490;
          --string: #047857;
          --property: #2563eb;
          --boolean: #c2410c;
          --comment: #64748b;
          --github: #334155;
          --plain: #334155;
          --operator: #64748b;

          --body-top: #ffffff;
          --body-mid: #e7eaee;
          --body-bottom: #c3cad3;

          --keyboard-top: #f1f3f6;
          --keyboard-bottom: #d4dae1;
          --key: #64748b;

          --bezel: #0b0f17;
          --cyan: #22d3ee;

          --ground-shadow: #0f172a;
        }

        .dark .dev-laptop {
          --screen: #080d18;
          --toolbar: #111827;
          --sidebar: #0d1420;

          --muted: #64748b;
          --line-number: #59677a;
          --divider: rgba(255, 255, 255, 0.055);

          --keyword: #c084fc;
          --variable: #38bdf8;
          --function: #22d3ee;
          --string: #34d399;
          --property: #60a5fa;
          --boolean: #fb923c;
          --comment: #94a3b8;
          --github: #f1f5f9;
          --plain: #cbd5e1;
          --operator: #94a3b8;

          --body-top: #3b4758;
          --body-mid: #202b3b;
          --body-bottom: #0f172a;

          --keyboard-top: #2c384b;
          --keyboard-bottom: #172033;
          --key: #cbd5e1;

          --bezel: #020617;
          --cyan: #22d3ee;

          --ground-shadow: #000000;
        }

        /* =========================================================
           TYPOGRAPHY
        ========================================================= */

        .dev-laptop text,
        .dev-laptop tspan {
          font-weight: 400 !important;
          font-style: normal !important;
          letter-spacing: 0;
        }

        /* =========================================================
           LAPTOP FLOAT
        ========================================================= */

        @keyframes laptopFloat {
          0%,
          100% {
            transform: translateY(0);
          }

          50% {
            transform: translateY(-7px);
          }
        }

        /* =========================================================
           AMBIENT SCREEN GLOW
        ========================================================= */

        @keyframes ambientGlow {
          0%,
          100% {
            opacity: 0.12;
            transform: scale(0.97);
          }

          50% {
            opacity: 0.27;
            transform: scale(1);
          }
        }

        /* =========================================================
           TRUE LINE-BY-LINE CODE ANIMATION
        ========================================================= */

        @keyframes typeLine {
          0% {
            opacity: 0;
            clip-path: inset(0 100% 0 0);
            transform: translateX(-7px);
          }

          4% {
            opacity: 1;
            clip-path: inset(0 100% 0 0);
            transform: translateX(-7px);
          }

          10% {
            opacity: 1;
            clip-path: inset(0 0 0 0);
            transform: translateX(0);
          }

          72% {
            opacity: 1;
            clip-path: inset(0 0 0 0);
            transform: translateX(0);
          }

          82% {
            opacity: 0;
            clip-path: inset(0 0 0 100%);
            transform: translateX(5px);
          }

          100% {
            opacity: 0;
            clip-path: inset(0 0 0 100%);
            transform: translateX(5px);
          }
        }

        /* =========================================================
           CURSOR
        ========================================================= */

        @keyframes cursorBlink {
          0%,
          45% {
            opacity: 1;
          }

          46%,
          100% {
            opacity: 0;
          }
        }

        /* =========================================================
           STATUS LIGHT
        ========================================================= */

        @keyframes statusPulse {
          0%,
          100% {
            opacity: 0.45;
          }

          50% {
            opacity: 1;
          }
        }

        .laptop-float {
          animation:
            laptopFloat
            6s
            ease-in-out
            infinite;

          transform-origin: center;
        }

        .ambient-glow {
          animation:
            ambientGlow
            5s
            ease-in-out
            infinite;

          transform-origin: center;
        }

        .code-row {
          opacity: 0;

          animation:
            typeLine
            ${ANIMATION_DURATION}s
            cubic-bezier(.22, 1, .36, 1)
            infinite;
        }

        .cursor {
          animation:
            cursorBlink
            0.8s
            steps(1)
            infinite;
        }

        .status {
          animation:
            statusPulse
            2.3s
            ease-in-out
            infinite;
        }

        /* =========================================================
           REDUCED MOTION
        ========================================================= */

        @media (prefers-reduced-motion: reduce) {
          .laptop-float,
          .ambient-glow,
          .code-row,
          .cursor,
          .status {
            animation: none !important;
          }

          .code-row {
            opacity: 1 !important;
            clip-path: none !important;
            transform: none !important;
          }

          .cursor {
            opacity: 1 !important;
          }
        }

        /* =========================================================
           MOBILE
        ========================================================= */

        @media (max-width: 767px) {
          .dev-laptop {
            display: none !important;
          }
        }
      `}</style>

      <div className="dev-laptop pointer-events-none relative mx-auto w-full max-w-[1100px] select-none">
        {/* Ambient HTML glow */}
        <div
          aria-hidden="true"
          className="
            pointer-events-none
            absolute
            left-1/2
            top-1/2
            h-[45%]
            w-[58%]
            -translate-x-1/2
            -translate-y-1/2
            rounded-full
            bg-cyan-400/10
            blur-[110px]
          "
        />

        <svg
          viewBox="0 0 1200 780"
          className="relative block h-auto w-full"
          preserveAspectRatio="xMidYMid meet"
          role="img"
          aria-label="Animated laptop displaying source code"
        >
          <defs>
            {/* =====================================================
                LAPTOP BODY GRADIENT
            ====================================================== */}

            <linearGradient
              id="bodyGradient"
              x1="0"
              y1="0"
              x2="1"
              y2="1"
            >
              <stop
                offset="0%"
                stopColor="var(--body-top)"
              />

              <stop
                offset="48%"
                stopColor="var(--body-mid)"
              />

              <stop
                offset="100%"
                stopColor="var(--body-bottom)"
              />
            </linearGradient>

            {/* =====================================================
                KEYBOARD GRADIENT
            ====================================================== */}

            <linearGradient
              id="keyboardGradient"
              x1="0"
              y1="0"
              x2="0"
              y2="1"
            >
              <stop
                offset="0%"
                stopColor="var(--keyboard-top)"
              />

              <stop
                offset="100%"
                stopColor="var(--keyboard-bottom)"
              />
            </linearGradient>

            {/* =====================================================
                SUBTLE DISPLAY SHADOW - LIGHT
            ====================================================== */}

            <filter
              id="displayShadowLight"
              x="-30%"
              y="-30%"
              width="160%"
              height="200%"
            >
              <feDropShadow
                dx="0"
                dy="17"
                stdDeviation="18"
                floodColor="#0f172a"
                floodOpacity="0.15"
              />
            </filter>

            {/* =====================================================
                SUBTLE DISPLAY SHADOW - DARK
            ====================================================== */}

            <filter
              id="displayShadowDark"
              x="-30%"
              y="-30%"
              width="160%"
              height="200%"
            >
              <feDropShadow
                dx="0"
                dy="19"
                stdDeviation="22"
                floodColor="#000000"
                floodOpacity="0.35"
              />
            </filter>

            {/* =====================================================
                SCREEN GLOW
            ====================================================== */}

            <filter
              id="screenGlow"
              x="-100%"
              y="-100%"
              width="300%"
              height="300%"
            >
              <feGaussianBlur stdDeviation="25" />
            </filter>

            {/* =====================================================
                SOFT GROUND SHADOW
            ====================================================== */}

            <filter
              id="groundShadowLight"
              x="-40%"
              y="-300%"
              width="180%"
              height="700%"
            >
              <feGaussianBlur stdDeviation="14" />
            </filter>

            <filter
              id="groundShadowDark"
              x="-40%"
              y="-300%"
              width="180%"
              height="700%"
            >
              <feGaussianBlur stdDeviation="18" />
            </filter>

            {/* =====================================================
                SCREEN CLIP
            ====================================================== */}

            <clipPath id="screenClip">
              <rect
                x="215"
                y="98"
                width="770"
                height="438"
                rx="18"
              />
            </clipPath>

            {/* =====================================================
                KEYBOARD CLIP
            ====================================================== */}

            <clipPath id="keyboardClip">
              <path
                d="
                  M205 582
                  C216 576 228 573 242 573
                  H958
                  C972 573 984 576 995 582
                  L1047 631
                  H153
                  Z
                "
              />
            </clipPath>
          </defs>

          {/* =======================================================
              GROUND SHADOW
              Sits behind the laptop and stays visible in both
              light and dark themes.
          ======================================================== */}

          <ellipse
            cx="600"
            cy="700"
            rx="430"
            ry="24"
            fill="var(--ground-shadow)"
            opacity="0.13"
            filter="url(#groundShadowLight)"
            className="dark:hidden"
          />

          <ellipse
            cx="600"
            cy="700"
            rx="430"
            ry="25"
            fill="var(--ground-shadow)"
            opacity="0.38"
            filter="url(#groundShadowDark)"
            className="hidden dark:block"
          />

          {/* Tight inner grounding shadow */}
          <ellipse
            cx="600"
            cy="696"
            rx="290"
            ry="12"
            fill="#0f172a"
            opacity="0.08"
            filter="url(#groundShadowLight)"
            className="dark:hidden"
          />

          <ellipse
            cx="600"
            cy="696"
            rx="290"
            ry="13"
            fill="#000000"
            opacity="0.24"
            filter="url(#groundShadowDark)"
            className="hidden dark:block"
          />

          <g className="laptop-float">
            {/* =====================================================
                SCREEN GLOW
            ====================================================== */}

            <rect
              x="190"
              y="76"
              width="820"
              height="485"
              rx="40"
              fill="var(--cyan)"
              opacity="0.1"
              filter="url(#screenGlow)"
              className="ambient-glow"
            />

            {/* =====================================================
                DISPLAY OUTER BODY - LIGHT
            ====================================================== */}

            <rect
              x="168"
              y="53"
              width="864"
              height="525"
              rx="40"
              fill="url(#bodyGradient)"
              filter="url(#displayShadowLight)"
              className="dark:hidden"
            />

            {/* =====================================================
                DISPLAY OUTER BODY - DARK
            ====================================================== */}

            <rect
              x="168"
              y="53"
              width="864"
              height="525"
              rx="40"
              fill="url(#bodyGradient)"
              filter="url(#displayShadowDark)"
              className="hidden dark:block"
            />

            {/* Subtle outer rim */}
            <rect
              x="169"
              y="54"
              width="862"
              height="523"
              rx="39"
              fill="none"
              stroke="var(--body-bottom)"
              strokeWidth="1.5"
              strokeOpacity=".7"
            />

            {/* =====================================================
                DISPLAY BEZEL
            ====================================================== */}

            <rect
              x="191"
              y="76"
              width="818"
              height="480"
              rx="28"
              fill="var(--bezel)"
            />

            {/* =====================================================
                SCREEN
            ====================================================== */}

            <rect
              x="215"
              y="98"
              width="770"
              height="438"
              rx="18"
              fill="var(--screen)"
            />

            {/* =====================================================
                CODE EDITOR
            ====================================================== */}

            <g clipPath="url(#screenClip)">
              {/* Top toolbar */}
              <rect
                x="215"
                y="98"
                width="770"
                height="46"
                fill="var(--toolbar)"
              />

              {/* Window controls */}
              <circle
                cx="244"
                cy="121"
                r="6"
                fill="#ff5f57"
              />

              <circle
                cx="265"
                cy="121"
                r="6"
                fill="#febc2e"
              />

              <circle
                cx="286"
                cy="121"
                r="6"
                fill="#28c840"
              />

              {/* File tab */}
              <rect
                x="320"
                y="105"
                width="150"
                height="30"
                rx="7"
                fill="var(--divider)"
              />

              <text
                x="342"
                y="125"
                fill="var(--muted)"
                fontFamily="ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace"
                fontSize="13"
                fontWeight="400"
              >
                app.tsx
              </text>

              {/* Sidebar */}
              <rect
                x="215"
                y="144"
                width="62"
                height="364"
                fill="var(--sidebar)"
              />

              <line
                x1="277"
                y1="144"
                x2="277"
                y2="508"
                stroke="var(--divider)"
                strokeWidth="1"
              />

              {/* =================================================
                  CODE
              ================================================= */}

              {code.map((line, index) => {
                const y = 158 + index * 27;

                return (
                  <React.Fragment key={index}>
                    {/* Line number */}
                    <text
                      x="248"
                      y={y}
                      textAnchor="middle"
                      dominantBaseline="middle"
                      fill="var(--line-number)"
                      fontFamily="ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace"
                      fontSize="11"
                      fontWeight="400"
                    >
                      {String(index + 1).padStart(2, "0")}
                    </text>

                    {/* Actual code row */}
                    {line.length > 0 && (
                      <g
                        className="code-row"
                        style={{
                          animationDelay: `${
                            index * LINE_STEP
                          }s`,
                        }}
                      >
                        <text
                          x="302"
                          y={y}
                          dominantBaseline="middle"
                          xmlSpace="preserve"
                          fontFamily="ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace"
                          fontSize={
                            index === code.length - 1
                              ? 15
                              : 16
                          }
                          fontWeight="400"
                          fontStyle="normal"
                          style={{
                            fontWeight: 400,
                            fontStyle: "normal",
                          }}
                        >
                          {line.map(
                            (
                              [text, type],
                              tokenIndex
                            ) => (
                              <tspan
                                key={tokenIndex}
                                fill={`var(--${type})`}
                                fontWeight="400"
                                fontStyle="normal"
                                style={{
                                  fontWeight: 400,
                                  fontStyle:
                                    "normal",
                                }}
                              >
                                {text}
                              </tspan>
                            )
                          )}
                        </text>
                      </g>
                    )}
                  </React.Fragment>
                );
              })}

              {/* =================================================
                  CURSOR
              ================================================= */}

              <rect
                x="700"
                y="447"
                width="2"
                height="18"
                rx="1"
                fill="var(--cyan)"
                className="cursor"
              />

              {/* =================================================
                  STATUS BAR
              ================================================= */}

              <rect
                x="215"
                y="508"
                width="770"
                height="28"
                fill="var(--toolbar)"
              />

              <text
                x="237"
                y="526"
                fill="var(--muted)"
                fontFamily="ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace"
                fontSize="10"
                fontWeight="400"
              >
                TypeScript
              </text>

              <text
                x="872"
                y="526"
                fill="var(--muted)"
                fontFamily="ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace"
                fontSize="10"
                fontWeight="400"
              >
                UTF-8
              </text>

              <circle
                cx="960"
                cy="522"
                r="3.5"
                fill="#22c55e"
                className="status"
              />
            </g>

            {/* =====================================================
                CAMERA
            ====================================================== */}

            <circle
              cx="600"
              cy="67"
              r="4"
              fill="#020617"
              opacity=".8"
            />

            <circle
              cx="600"
              cy="67"
              r="1.3"
              fill="#475569"
            />

            {/* =====================================================
                HINGE
            ====================================================== */}

            <rect
              x="488"
              y="566"
              width="224"
              height="10"
              rx="5"
              fill="#0f172a"
              opacity=".23"
            />

            {/* =====================================================
                LAPTOP BASE
            ====================================================== */}

            <path
              d="
                M148 575
                C160 564 184 557 215 557
                H985
                C1016 557 1040 564 1052 575
                L1118 637
                C1132 650 1122 668 1102 674
                C1082 680 1056 682 1026 682
                H174
                C144 682 118 680 98 674
                C78 668 68 650 82 637
                Z
              "
              fill="url(#bodyGradient)"
            />

            {/* =====================================================
                KEYBOARD TRAY
            ====================================================== */}

            <path
              d="
                M222 578
                H978
                C989 578 999 581 1007 588
                L1054 631
                H146
                L193 588
                C201 581 211 578 222 578
                Z
              "
              fill="url(#keyboardGradient)"
            />

            {/* =====================================================
                KEYBOARD
            ====================================================== */}

            <g clipPath="url(#keyboardClip)">
              {Array.from({
                length: 5,
              }).map((_, row) =>
                Array.from({
                  length: 14,
                }).map((_, col) => {
                  const width = 44;
                  const height = 14;
                  const gapX = 8;
                  const gapY = 8;

                  const x =
                    205 +
                    col *
                      (width + gapX) +
                    (row % 2 ? 10 : 0);

                  const y =
                    584 +
                    row *
                      (height + gapY);

                  return (
                    <rect
                      key={`${row}-${col}`}
                      x={x}
                      y={y}
                      width={width}
                      height={height}
                      rx="4"
                      fill="var(--key)"
                      opacity=".2"
                    />
                  );
                })
              )}

              {/* Spacebar */}
              <rect
                x="468"
                y="620"
                width="264"
                height="14"
                rx="5"
                fill="var(--key)"
                opacity=".14"
              />

              {/* Trackpad */}
              <rect
                x="488"
                y="644"
                width="224"
                height="22"
                rx="8"
                fill="var(--key)"
                opacity=".08"
              />
            </g>

            {/* =====================================================
                FRONT EDGE
            ====================================================== */}

            <line
              x1="100"
              y1="674"
              x2="1100"
              y2="674"
              stroke="var(--body-bottom)"
              strokeWidth="1.5"
              strokeOpacity=".7"
            />

            {/* =====================================================
                CENTER STATUS LIGHT
            ====================================================== */}

            <circle
              cx="600"
              cy="673"
              r="3"
              fill="var(--cyan)"
              className="status"
            />
          </g>
        </svg>
      </div>
    </div>
  );
}
