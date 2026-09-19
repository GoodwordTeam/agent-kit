export type DirectorySection = "skills" | "packs" | "protocols" | "roles" | "references";
export type FileSection = "schemas" | "policies" | "profiles" | "adapters";
export type Section = DirectorySection | FileSection;

/**
 * The five sections `ak validate` checks in both directions: no entry without a
 * directory, and no directory without an entry.
 */
export const DIRECTORY_SECTIONS: ReadonlyArray<DirectorySection> = [
  "skills",
  "packs",
  "protocols",
  "roles",
  "references",
];

export const FILE_SECTIONS: ReadonlyArray<FileSection> = ["schemas", "policies", "profiles", "adapters"];

export const ALL_SECTIONS: ReadonlyArray<Section> = [...DIRECTORY_SECTIONS, ...FILE_SECTIONS];

const PREFERRED_BODY: Record<DirectorySection, string> = {
  skills: "SKILL.md",
  packs: "PACK.md",
  protocols: "PROTOCOL.md",
  roles: "ROLE.md",
  references: "REFERENCE.md",
};

/**
 * Sections whose canonical body file name is mandated rather than preferred.
 *
 * `skills` because the host loader reads `SKILL.md` by name; `protocols` and
 * `roles` because AUTHORING.md §12 gives each one body file and nothing else
 * distinguishes a body from the long material behind it (§12.1's
 * `protocols/<id>/references/`). A differently named body in these trees is an
 * error, not a warning: the packager would ship the directory without its body.
 */
export const MANDATORY_BODY_SECTIONS: ReadonlyArray<DirectorySection> = ["skills", "protocols", "roles"];

export function entryDir(section: DirectorySection, id: string): string {
  return `${section}/${id}`;
}

export function preferredBodyFile(section: DirectorySection): string {
  return PREFERRED_BODY[section];
}

export function entryBodyPath(section: DirectorySection, id: string): string {
  return `${entryDir(section, id)}/${preferredBodyFile(section)}`;
}

export function entryFilePath(section: FileSection, id: string): string {
  switch (section) {
    case "schemas":
      return `schemas/${id}.schema.json`;
    case "policies":
      return `policies/${id}.yaml`;
    case "profiles":
      return `profiles/${id}.yaml`;
    case "adapters":
      return `adapters/${id}/CONTRACT.md`;
  }
}

export function isDirectorySection(section: string): section is DirectorySection {
  return (DIRECTORY_SECTIONS as ReadonlyArray<string>).includes(section);
}
