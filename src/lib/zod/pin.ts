import { z } from "zod";

export const pinValidation = z
  .string()
  .min(4)
  .max(4)
  .transform((pin) => pin.toUpperCase());
