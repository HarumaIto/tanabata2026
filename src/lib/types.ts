export type Tanzaku = {
  id: string;
  imageUrl: string; // e.g. /uploads/xxxx.jpg  (served from public/uploads)
  color: string; // accent color for the paper edge / string, hex string
  createdAt: number; // Date.now()
  // Deterministic placement seed so every client renders the same spot on the bamboo.
  seed: number;
};

export type TanzakuListResponse = {
  tanzaku: Tanzaku[];
};

export type TanzakuCreateResponse = {
  tanzaku: Tanzaku;
};
