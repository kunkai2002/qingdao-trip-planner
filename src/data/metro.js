/* Schematic metro lines. Nodes are WGS-84 and shifted at draw time.
   These connect major stations only — they are a wayfinding hint, not a
   survey-accurate track alignment. */

export const METRO_LINES = [
  {
    name: '3 号线',
    color: '#c0392b',
    pts: [
      [36.063, 120.312],
      [36.0662, 120.316],
      [36.0668, 120.3283],
      [36.053, 120.348],
      [36.063, 120.383],
      [36.1, 120.402],
      [36.145, 120.43],
    ],
  },
  {
    name: '2 号线',
    color: '#2980b9',
    pts: [
      [36.0748, 120.3552],
      [36.0662, 120.386],
      [36.063, 120.383],
      [36.09, 120.468],
    ],
  },
  {
    name: '1 号线',
    color: '#e67e22',
    pts: [
      [36.0748, 120.3552],
      [36.063, 120.312],
      [36.175, 120.374],
    ],
  },
  {
    name: '4 号线',
    color: '#27ae60',
    pts: [
      [36.0668, 120.3283],
      [36.063, 120.383],
      [36.14, 120.55],
    ],
  },
]
