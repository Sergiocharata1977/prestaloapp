import { DEFAULT_SCORING_CONFIG, SCORING_ITEMS_CATALOG } from "@/lib/scoring/utils";
import { ScoringService } from "@/services/ScoringService";

describe("ScoringService.calcularScore", () => {
  it("calcula score ponderado y tier A cuando los puntajes son altos", () => {
    const items = SCORING_ITEMS_CATALOG.map((item) => ({
      ...item,
      puntaje: 9,
    }));

    const result = ScoringService.calcularScore(items, DEFAULT_SCORING_CONFIG);

    expect(result.score_cualitativo).toBe(9);
    expect(result.score_conflictos).toBe(9);
    expect(result.score_cuantitativo).toBe(9);
    expect(result.score_final).toBeCloseTo(9, 5);
    expect(result.tier).toBe("A");
  });

  it("usa cero en categorias sin puntaje y cae en tier reprobado", () => {
    const items = SCORING_ITEMS_CATALOG.map((item) => ({
      ...item,
      puntaje: item.categoria === "cualitativo" ? 4 : null,
    }));

    const result = ScoringService.calcularScore(items, DEFAULT_SCORING_CONFIG);

    expect(result.score_cualitativo).toBe(4);
    expect(result.score_conflictos).toBe(0);
    expect(result.score_cuantitativo).toBe(0);
    expect(result.score_final).toBeCloseTo(1.72, 2);
    expect(result.tier).toBe("reprobado");
  });
});
