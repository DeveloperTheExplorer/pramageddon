export const BABY_NAMES = [
  'Maren',
  'Sindre',
  'Ingrid',
  'Bjørn',
  'Frida',
  'Jonas',
  'Solveig',
  'Eirik',
  'Live',
  'Aksel',
];

export const PRAM_COLORS = [
  { body: '#e8735a', canopy: '#c95242', blanket: '#f6d365', trim: '#ffe9c7' },
  { body: '#78c6b0', canopy: '#3f9c8d', blanket: '#ff9eb5', trim: '#e9fff4' },
  { body: '#e9b949', canopy: '#c58f2a', blanket: '#8ecae6', trim: '#fff5cf' },
  { body: '#9a8cda', canopy: '#7464bb', blanket: '#b8f2e6', trim: '#f3efff' },
  { body: '#e885a8', canopy: '#c45f84', blanket: '#ffd166', trim: '#ffeef4' },
];

export const ITEM_META = {
  pacifier: {
    label: 'Pacifier',
    short: 'Binky',
    color: '#ff9ec7',
    station: 'paci',
    hint: 'Grab a binky from the porch basket.',
  },
  bottle: {
    label: 'Warm bottle',
    short: 'Bottle',
    color: '#ffd166',
    station: 'warmer',
    hint: 'Grab a bottle from the crate and warm it on the stove inside.',
  },
  blanket: {
    label: 'Blanket',
    short: 'Blankie',
    color: '#8ecae6',
    station: 'blanket',
    hint: 'Fetch a fresh blanket from the porch pile.',
  },
  teddy: {
    label: 'Teddy',
    short: 'Teddy',
    color: '#c98b5b',
    station: 'teddy',
    hint: 'Find a teddy in the chest inside.',
  },
};

export const NEED_POOL = ['pacifier', 'bottle', 'blanket', 'teddy'];

export const NIGHTS = [
  {
    number: 1,
    name: 'Dagslur',
    clock: '14:00',
    subtitle: 'Inger’s first outdoor nap. Three prams. The whole street is watching.',
    duration: 110,
    pramCount: 3,
    fussRate: 0.028,
    fussRelief: 7.5,
    needBite: 0.037,
    cryDrain: 2.7,
    foxEvery: 0,
    warmth: 0.25,
    starScore: [900, 1700, 2600],
    tip: 'Feed the need before it becomes a wail.',
  },
  {
    number: 2,
    name: 'Reven i hagen',
    clock: '17:30',
    subtitle: 'Inger has four prams. And one very rude fox.',
    duration: 125,
    pramCount: 4,
    fussRate: 0.033,
    fussRelief: 6.5,
    needBite: 0.044,
    cryDrain: 3.1,
    foxEvery: 34,
    warmth: 0.5,
    starScore: [1300, 2400, 3600],
    tip: 'Shoo the fox before it reaches a pram.',
  },
  {
    number: 3,
    name: 'Den lyse kvelden',
    clock: '20:45',
    subtitle: 'Five prams. The sun refuses to go down. Neither does Inger.',
    duration: 145,
    pramCount: 5,
    fussRate: 0.039,
    fussRelief: 5.7,
    needBite: 0.051,
    cryDrain: 3.6,
    foxEvery: 25,
    warmth: 0.8,
    starScore: [1800, 3200, 4800],
    tip: 'Scoop, soothe, return. Keep the loop moving.',
  },
];

export const PRAM_LAYOUTS = [
  { x: -7.4, z: 5.0, rot: 0.12 },
  { x: -3.8, z: 7.1, rot: -0.08 },
  { x: 0.0, z: 5.15, rot: 0.04 },
  { x: 3.8, z: 7.1, rot: 0.1 },
  { x: 7.4, z: 5.0, rot: -0.12 },
];

export const STATIONS = {
  paci: { x: -4.55, z: 0.35, label: 'Binky basket', icon: 'pacifier' },
  blanket: { x: 4.55, z: 0.35, label: 'Blanket pile', icon: 'blanket' },
  bottles: { x: 4.65, z: -4.8, label: 'Bottle crate', icon: 'bottle' },
  warmer: { x: 2.55, z: -7.0, label: 'Bottle warmer', icon: 'bottle' },
  teddy: { x: 5.0, z: -2.4, label: 'Teddy chest', icon: 'teddy' },
  crib: { x: -3.35, z: -6.7, label: 'The Big Crib', icon: 'zzz' },
};

export const PLAYER_START = { x: 0.2, z: 0.5 };

export const COLORS = {
  ink: '#27203c',
  cream: '#fff6df',
  coral: '#ff7a6b',
  pink: '#ff9ec7',
  mint: '#7ee0c3',
  sky: '#8ecae6',
  mustard: '#ffd166',
  lavender: '#9b8cff',
  red: '#e84a5f',
  warm: '#ffb45e',
};
