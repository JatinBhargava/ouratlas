/** Shared types used across the app. */

export type HelloResponse = {
  message: string;
  method?: string;
};

export type ApiError = {
  status: number;
  message: string;
};

/** An image chosen for an album. `url` is an object URL local to the tab. */
export type Photo = {
  id: string;
  file: File;
  url: string;
};
