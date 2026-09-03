/**
 * Atelier Exhibition 3D Book Presentation Configuration
 * 
 * To add or replace slides:
 * 1. Place JPG/PNG slide images in ./assets/slides/
 * 2. Update the `slides` array below with the relative path.
 * 3. Update or adjust the `spreads` array as desired.
 * 
 * All asset paths MUST remain relative (./assets/...) to support
 * hosting from subdirectories like username.github.io/repository-name/
 */

export const config = {
  // Title and metadata shown in the curatorial header
  exhibition: {
    badge: "Exhibition In Situ",
    catalogueNumber: "CATALOGUE RAISONNÉ № 04",
    title: "Architecture of Silence & Light",
    subtitle: "Atelier Éditions • Limited Curatorial Pressing of L Folios",
    edition: "EDITION 04 / 50",
    lightingPreset: "Natural Overhead Skylight",
    copyright: "© MMXXIV ATELIER ÉDITIONS",
    colophonTitle: "Monographica Vol. IV",
    colophonDesc: "Hand-bound archival cotton paper, hot stamped gilt foil, natural mineral pigments."
  },

  // Book 3D physical specifications
  book: {
    pageWidth: 4.8,       // 3D units width of each leaf
    pageHeight: 6.4,      // 3D units height of each leaf
    pageThickness: 0.012, // Subtle paper thickness
    coverWidth: 4.95,
    coverHeight: 6.6,
    coverThickness: 0.08,
    spineWidth: 0.46,
    maxPageBend: 1.35,    // Procedural curl bending strength
    turnDuration: 950,    // Milliseconds for a page turn
    initialElevation: 32, // Degrees
    initialAzimuth: 14,   // Degrees
    // Book hardcover & pedestal texture paths (relative)
    frontCover: "./assets/book/cover-front.jpg",
    backCover: "./assets/book/cover-back.jpg",
    spine: "./assets/book/spine.jpg",
    travertine: "./assets/book/travertine.jpg"
  },

  // Slide image textures (all relative paths)
  slides: [
    "./assets/slides/slide-01.jpg",
    "./assets/slides/slide-02.jpg",
    "./assets/slides/slide-03.jpg",
    "./assets/slides/slide-04.jpg",
    "./assets/slides/slide-05.jpg",
    "./assets/slides/slide-06.jpg",
    "./assets/slides/slide-07.jpg",
    "./assets/slides/slide-08.jpg",
    "./assets/slides/slide-09.jpg",
    "./assets/slides/slide-10.jpg",
    "./assets/slides/slide-11.jpg",
    "./assets/slides/slide-12.jpg"
  ],

  // Spreads definition: each spread presents a left page and right page
  spreads: [
    {
      id: 1,
      leftSlideIndex: 0,
      rightSlideIndex: 1,
      title: "Title Page & Colophon",
      subtitle: "Hand-set Monotype Baskerville & Hot Gilt Stamping",
      annotation1: "Deckled mould-made rag paper, 280 gsm with cold-pressed tactile tooth.",
      annotation2: "Hand-pressed watermark on archival vellum.",
      paperStock: "Cotton Rag 280gsm"
    },
    {
      id: 2,
      leftSlideIndex: 2,
      rightSlideIndex: 3,
      title: "Plate I & II — The Vestibule",
      subtitle: "Morning light over poured concrete & polished aggregate",
      annotation1: "Continuous monolithic slab perspective with raking light.",
      annotation2: "Offset monochrome photogravure printing.",
      paperStock: "Cotton Rag 280gsm"
    },
    {
      id: 3,
      leftSlideIndex: 4,
      rightSlideIndex: 5,
      title: "Plate V & VI — The Lightwell",
      subtitle: "Perpendicular shadow lines along limestone colonnade",
      annotation1: "High raking daylight at 38° elevation.",
      annotation2: "Archival carbon pigment transfer.",
      paperStock: "Cotton Rag 280gsm"
    },
    {
      id: 4,
      leftSlideIndex: 6,
      rightSlideIndex: 7,
      title: "Plate VII & VIII — The Travertine Plinth",
      subtitle: "Colonnade study at 1:1 scale",
      annotation1: "Deckled mould-made rag paper, 280 gsm with cold-pressed tactile tooth.",
      annotation2: "Curated study of the colonnade colonias under raking sun; offset monochrome print.",
      paperStock: "Cotton Rag 280gsm"
    },
    {
      id: 5,
      leftSlideIndex: 8,
      rightSlideIndex: 9,
      title: "Plate IX & X — Courtyard at Noon",
      subtitle: "High ambient reflection across silent monolithic basin",
      annotation1: "Deep black archival carbon inks with matte varnish.",
      annotation2: "Symmetrical solar alignment study.",
      paperStock: "Cotton Rag 280gsm"
    },
    {
      id: 6,
      leftSlideIndex: 10,
      rightSlideIndex: 11,
      title: "Plate XI & XII — The Cloister Gallery",
      subtitle: "Continuous limestone arcade vanishing into chiaroscuro",
      annotation1: "Section-sewn binding with unbleached French linen thread.",
      annotation2: "Concluding curatorial folio plate.",
      paperStock: "Cotton Rag 280gsm"
    }
  ]
};
