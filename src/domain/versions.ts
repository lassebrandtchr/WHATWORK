/**
 * Versionsstyring af alt, der kan ændre et output.
 *
 * Specifikationen kræver, at samme input, samme seed og samme motorversion kan
 * reproducere samme program eller workout. Derfor gemmes hver version sammen med
 * den session, den producerede — og en ny regelsæson må aldrig skrive sig ind i
 * historiske planer bagudrettet.
 */

/** Domæneservices: benchmark-, load-, feasibility- og constraintlogik. */
export const DOMAIN_VERSION = '3.0.0';

/** Programmotoren (Motor B). */
export const PROGRAM_ENGINE_VERSION = '3.0.0';

/** Ontologien over øvelser: mønstre, fatigue, substitutionsgrupper, kompetencekrav. */
export const ONTOLOGY_VERSION = '3.0.0';

/** Afledte statistikmetrics. Ændres definitionen, skal tallet også ændres. */
export const METRIC_VERSION = '1.0.0';

/** Schemaversion for gemte sessioner i Historik. Styrer migrering. */
export const SESSION_SCHEMA_VERSION = 1;

/**
 * Samlet fingeraftryk af de versioner, der bestemmer et output. Gemmes på hver
 * session, så en gammel plan kan kendes fra en, der er bygget efter nye regler.
 */
export interface EngineProvenance {
  generatorVersion: string;
  domainVersion: string;
  ontologyVersion: string;
  exerciseLibraryVersion: string;
  rulesVersion: string;
  /** Version pr. anvendt regelsæt, fx { HYROX: '26/27', IPF: '2025-01' }. */
  ruleVersions: Record<string, string>;
  seed: number;
}
