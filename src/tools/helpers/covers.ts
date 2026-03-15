/**
 * Cover image format detection and built-in cover catalog
 * Resolves shorthand names (e.g., "gradient_8", "solid_blue") to full Notion cover URLs
 */

import { NotionMCPError } from './errors.js'
import { isSafeUrl } from './security.js'

const NOTION_COVER_BASE = 'https://www.notion.so/images/page-cover'

/** Complete catalog of Notion's built-in cover images */
const COVER_CATALOG: Record<string, string> = {
  // Solid colors
  solid_red: `${NOTION_COVER_BASE}/solid_red.png`,
  solid_yellow: `${NOTION_COVER_BASE}/solid_yellow.png`,
  solid_blue: `${NOTION_COVER_BASE}/solid_blue.png`,
  solid_beige: `${NOTION_COVER_BASE}/solid_beige.png`,

  // Gradients (1-9 are .png, 10-11 are .jpg)
  gradient_1: `${NOTION_COVER_BASE}/gradients_1.png`,
  gradient_2: `${NOTION_COVER_BASE}/gradients_2.png`,
  gradient_3: `${NOTION_COVER_BASE}/gradients_3.png`,
  gradient_4: `${NOTION_COVER_BASE}/gradients_4.png`,
  gradient_5: `${NOTION_COVER_BASE}/gradients_5.png`,
  gradient_6: `${NOTION_COVER_BASE}/gradients_6.png`,
  gradient_7: `${NOTION_COVER_BASE}/gradients_7.png`,
  gradient_8: `${NOTION_COVER_BASE}/gradients_8.png`,
  gradient_9: `${NOTION_COVER_BASE}/gradients_9.png`,
  gradient_10: `${NOTION_COVER_BASE}/gradients_10.jpg`,
  gradient_11: `${NOTION_COVER_BASE}/gradients_11.jpg`,

  // Woodcuts (Japanese-style)
  woodcuts_1: `${NOTION_COVER_BASE}/woodcuts_1.jpg`,
  woodcuts_2: `${NOTION_COVER_BASE}/woodcuts_2.jpg`,
  woodcuts_3: `${NOTION_COVER_BASE}/woodcuts_3.jpg`,
  woodcuts_4: `${NOTION_COVER_BASE}/woodcuts_4.jpg`,
  woodcuts_5: `${NOTION_COVER_BASE}/woodcuts_5.jpg`,
  woodcuts_6: `${NOTION_COVER_BASE}/woodcuts_6.jpg`,
  woodcuts_7: `${NOTION_COVER_BASE}/woodcuts_7.jpg`,
  woodcuts_8: `${NOTION_COVER_BASE}/woodcuts_8.jpg`,
  woodcuts_9: `${NOTION_COVER_BASE}/woodcuts_9.jpg`,
  woodcuts_10: `${NOTION_COVER_BASE}/woodcuts_10.jpg`,
  woodcuts_11: `${NOTION_COVER_BASE}/woodcuts_11.jpg`,
  woodcuts_13: `${NOTION_COVER_BASE}/woodcuts_13.jpg`,
  woodcuts_14: `${NOTION_COVER_BASE}/woodcuts_14.jpg`,
  woodcuts_15: `${NOTION_COVER_BASE}/woodcuts_15.jpg`,
  woodcuts_16: `${NOTION_COVER_BASE}/woodcuts_16.jpg`,

  // NASA
  nasa_carina_nebula: `${NOTION_COVER_BASE}/nasa_carina_nebula.jpg`,
  nasa_transonic_tunnel: `${NOTION_COVER_BASE}/nasa_transonic_tunnel.jpg`,
  nasa_the_blue_marble: `${NOTION_COVER_BASE}/nasa_the_blue_marble.jpg`,
  nasa_wrights_first_flight: `${NOTION_COVER_BASE}/nasa_wrights_first_flight.jpg`,
  nasa_eagle_in_lunar_orbit: `${NOTION_COVER_BASE}/nasa_eagle_in_lunar_orbit.jpg`,
  nasa_space_shuttle_columbia: `${NOTION_COVER_BASE}/nasa_space_shuttle_columbia.jpg`,
  nasa_space_shuttle_columbia_and_sunrise: `${NOTION_COVER_BASE}/nasa_space_shuttle_columbia_and_sunrise.jpg`,
  nasa_reduced_gravity_walking_simulator: `${NOTION_COVER_BASE}/nasa_reduced_gravity_walking_simulator.jpg`,
  nasa_fingerprints_of_water_on_the_sand: `${NOTION_COVER_BASE}/nasa_fingerprints_of_water_on_the_sand.jpg`,
  nasa_earth_grid: `${NOTION_COVER_BASE}/nasa_earth_grid.jpg`,
  nasa_orion_nebula: `${NOTION_COVER_BASE}/nasa_orion_nebula.jpg`,
  nasa_tim_peake_spacewalk: `${NOTION_COVER_BASE}/nasa_tim_peake_spacewalk.jpg`,

  // The Metropolitan Museum of Art
  met_william_morris_1875: `${NOTION_COVER_BASE}/met_william_morris_1875.jpg`,
  met_silk_kashan_carpet: `${NOTION_COVER_BASE}/met_silk_kashan_carpet.jpg`,
  met_horace_pippin: `${NOTION_COVER_BASE}/met_horace_pippin.jpg`,
  met_paul_signac: `${NOTION_COVER_BASE}/met_paul_signac.jpg`,
  met_fitz_henry_lane: `${NOTION_COVER_BASE}/met_fitz_henry_lane.jpg`,
  met_william_turner_1835: `${NOTION_COVER_BASE}/met_william_turner_1835.jpg`,
  met_arnold_bocklin_1880: `${NOTION_COVER_BASE}/met_arnold_bocklin_1880.jpg`,

  // Rijksmuseum
  rijksmuseum_jan_lievens_1627: `${NOTION_COVER_BASE}/rijksmuseum_jan_lievens_1627.jpg`,
  rijksmuseum_avercamp_1608: `${NOTION_COVER_BASE}/rijksmuseum_avercamp_1608.jpg`,
  rijksmuseum_avercamp_1620: `${NOTION_COVER_BASE}/rijksmuseum_avercamp_1620.jpg`,
  rijksmuseum_claesz_1628: `${NOTION_COVER_BASE}/rijksmuseum_claesz_1628.jpg`,
  rijksmuseum_mignons_1660: `${NOTION_COVER_BASE}/rijksmuseum_mignons_1660.jpg`,
  rijksmuseum_jansz_1636: `${NOTION_COVER_BASE}/rijksmuseum_jansz_1636.jpg`,
  rijksmuseum_jansz_1637: `${NOTION_COVER_BASE}/rijksmuseum_jansz_1637.jpg`,
  rijksmuseum_jansz_1641: `${NOTION_COVER_BASE}/rijksmuseum_jansz_1641.jpg`,
  rijksmuseum_rembrandt_1642: `${NOTION_COVER_BASE}/rijksmuseum_rembrandt_1642.jpg`
}

/**
 * Format a cover value into the Notion API cover object.
 * Accepts:
 * - Full URL (http/https) -> external cover
 * - Shorthand name (e.g., "gradient_8", "solid_blue") -> resolved to Notion CDN URL
 */
export function formatCover(value: string): { type: 'external'; external: { url: string } } {
  // Full URL (with safety check against javascript:, data:, etc.)
  if (value.startsWith('http://') || value.startsWith('https://')) {
    if (!isSafeUrl(value)) {
      throw new NotionMCPError(
        `Unsafe cover URL: "${value}". Use http: or https: URLs only.`,
        'VALIDATION_ERROR',
        'Provide a valid http: or https: URL for the cover image'
      )
    }
    return { type: 'external', external: { url: value } }
  }

  // Reject dangerous URL schemes before shorthand lookup
  if (!isSafeUrl(value)) {
    throw new NotionMCPError(
      `Unsafe cover URL: "${value}". Use http: or https: URLs only.`,
      'VALIDATION_ERROR',
      'Provide a valid http: or https: URL for the cover image'
    )
  }

  // Shorthand lookup
  const url = COVER_CATALOG[value]
  if (url) {
    return { type: 'external', external: { url } }
  }

  // Unknown shorthand
  throw new NotionMCPError(
    `Unknown cover shorthand: "${value}". Use a URL or one of: ${Object.keys(COVER_CATALOG).join(', ')}`,
    'VALIDATION_ERROR',
    'Provide a valid URL or a recognized cover shorthand name'
  )
}
