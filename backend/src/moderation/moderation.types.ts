export interface ModerationResult {
  /** true si el archivo NO debe usarse (contenido sexual, armas o drogas). */
  blocked: boolean;
  /** Categorías que dispararon el bloqueo: 'sexual' | 'weapon' | 'drugs'. */
  reasons: string[];
  /** false si no se pudo consultar (sin llaves, sin red, error de la API). */
  checked: boolean;
}
