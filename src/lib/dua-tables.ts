export const DUA_TABLES: [string, string][] = [
  ['tbl_dua', 'Duas'],
  ['tbl_dua_Urdu', 'More Duas'],
  ['tbl_prayer', 'Prayers'],
  ['tbl_namaz_e_janaza', 'Janaza'],
  ['tbl_roza', 'Roza'],
]

const TABLE_ALIASES: Record<string, string> = {
  tbl_dua: 'tbl_dua',
  tbl_dua_Urdu: 'tbl_dua_Urdu',
  tbl_prayer: 'tbl_prayer',
  tbl_namaz_e_janaza: 'tbl_namaz_e_janaza',
  tbl_roza: 'tbl_roza',
}

export const DUA_COLS = ['dua_ID', 'dua_title', 'dua_seq', 'dua_desc', 'dua_arabic', 'dua_urdu', 'dua_eng', 'dua_ref']

export function isDuaTable(t: string): boolean {
  return !!t && TABLE_ALIASES[t] === t
}

export function resolveDuaTable(t: string): string {
  return TABLE_ALIASES[t] || t
}