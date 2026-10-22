import { Router } from "express";
import type { SignRepository } from "../repositories/types.js";

export function signsRouter(signs: SignRepository): Router {
  const router = Router();

  router.get("/", async (_req, res) => {
    res.json(await signs.list());
  });

  return router;
}
