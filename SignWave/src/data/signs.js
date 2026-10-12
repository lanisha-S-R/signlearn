// signs.js - the 26 ASL alphabet signs shown in the Learning module.
// `image` files are cropped from the supplied StartASL alphabet sheet
// (see public/signs and ml/extract_reference.py).

const BASE = import.meta.env?.BASE_URL ?? "/";

const RAW = [
  ["A", "Make a fist with your thumb resting along the side of your index finger."],
  ["B", "Hold your fingers straight up and together, with your thumb folded across your palm."],
  ["C", "Curve your fingers and thumb into the shape of a C."],
  ["D", "Point your index finger up. Your other fingertips touch your thumb in a circle."],
  ["E", "Bend your fingertips down onto your thumb, knuckles rounded."],
  ["F", "Touch your thumb and index finger together. Keep the other three fingers straight."],
  ["G", "Point your index finger and thumb sideways, parallel. Other fingers closed."],
  ["H", "Point your index and middle fingers sideways together. Thumb tucked."],
  ["I", "Make a fist and point your little finger up."],
  ["J", "Start with the I handshape (little finger up), then draw a J in the air.", true],
  ["K", "Index and middle fingers up in a V, thumb touching the base of the middle finger."],
  ["L", "Index finger up and thumb out to the side, making an L."],
  ["M", "Fold your first three fingers over your thumb."],
  ["N", "Fold your first two fingers over your thumb."],
  ["O", "Curve all your fingers so the tips meet your thumb in an O."],
  ["P", "Like K, but pointing down: index and middle fingers out, thumb between them."],
  ["Q", "Like G, but pointing down: index finger and thumb pointing at the floor."],
  ["R", "Cross your middle finger over your index finger, both pointing up."],
  ["S", "Make a fist with your thumb across the front of your fingers."],
  ["T", "Make a fist with your thumb tucked between your index and middle fingers."],
  ["U", "Index and middle fingers up and held together."],
  ["V", "Index and middle fingers up and spread apart."],
  ["W", "Index, middle and ring fingers up and spread. Thumb holds down the little finger."],
  ["X", "Make a fist and bend your index finger into a hook."],
  ["Y", "Extend your thumb and little finger. Fold the other three."],
  ["Z", "Point your index finger and draw a Z in the air.", true],
];

export const SIGNS = RAW.map(([letter, hint, motion]) => ({
  letter,
  hint,
  motion: !!motion,
  image: `${BASE}signs/${letter}.png`,
}));

export const LETTERS = SIGNS.map((s) => s.letter);
export const getSign = (letter) => SIGNS.find((s) => s.letter === letter) || SIGNS[0];

export const MOTION_NOTE =
  "J and Z involve movement. This screen can only check the starting hand shape; practise the motion while watching the picture.";
