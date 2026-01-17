/**
 * Listing Categories for ArtLink Marketplace
 * Organized by type with icons and descriptions
 */

export interface CategoryItem {
  value: string;
  label: string;
  icon: string;
  description: string;
  color: string;
}

export interface CategoryGroup {
  name: string;
  categories: string[];
}

export const LISTING_CATEGORIES: CategoryItem[] = [
  // Art Categories
  {
    value: 'paintings',
    label: 'Paintings',
    icon: 'palette',
    description: 'Original paintings, canvas art, watercolors',
    color: 'purple'
  },
  {
    value: 'sculptures',
    label: 'Sculptures',
    icon: 'category',
    description: '3D art pieces, statues, figurines',
    color: 'indigo'
  },
  {
    value: 'digital-art',
    label: 'Digital Art',
    icon: 'computer',
    description: 'Digital illustrations, NFTs, graphic designs',
    color: 'blue'
  },
  {
    value: 'photography',
    label: 'Photography',
    icon: 'photo_camera',
    description: 'Prints, photo art, professional photography',
    color: 'cyan'
  },
  {
    value: 'prints',
    label: 'Prints & Reproductions',
    icon: 'print',
    description: 'Art prints, posters, reproductions',
    color: 'teal'
  },
  {
    value: 'drawings',
    label: 'Drawings & Sketches',
    icon: 'draw',
    description: 'Pencil, charcoal, ink drawings',
    color: 'green'
  },
  
  // Commission Services
  {
    value: 'commissions',
    label: 'Commission Services',
    icon: 'brush',
    description: 'Custom artwork, portraits, character designs',
    color: 'pink'
  },
  {
    value: 'design-services',
    label: 'Design Services',
    icon: 'design_services',
    description: 'Logo design, branding, illustration services',
    color: 'rose'
  },
  
  // Art Supplies & Tools
  {
    value: 'painting-supplies',
    label: 'Painting Supplies',
    icon: 'colorize',
    description: 'Paints, brushes, canvases, easels',
    color: 'orange'
  },
  {
    value: 'drawing-supplies',
    label: 'Drawing Supplies',
    icon: 'edit',
    description: 'Pencils, markers, sketchbooks, paper',
    color: 'amber'
  },
  {
    value: 'digital-tools',
    label: 'Digital Tools',
    icon: 'tablet',
    description: 'Drawing tablets, stylus, software',
    color: 'lime'
  },
  {
    value: 'crafting-supplies',
    label: 'Crafting Supplies',
    icon: 'handyman',
    description: 'Clay, resin, craft materials',
    color: 'emerald'
  },
  
  // Other
  {
    value: 'art-books',
    label: 'Art Books & Tutorials',
    icon: 'menu_book',
    description: 'Educational materials, art books, guides',
    color: 'violet'
  },
  {
    value: 'frames',
    label: 'Frames & Display',
    icon: 'crop_square',
    description: 'Picture frames, display stands, mounting',
    color: 'fuchsia'
  },
  {
    value: 'other',
    label: 'Other',
    icon: 'more_horiz',
    description: 'Other art-related items',
    color: 'gray'
  }
];

// Category groups for better organization
export const CATEGORY_GROUPS = [
  {
    name: 'Artwork',
    categories: ['paintings', 'sculptures', 'digital-art', 'photography', 'prints', 'drawings']
  },
  {
    name: 'Services',
    categories: ['commissions', 'design-services']
  },
  {
    name: 'Art Supplies',
    categories: ['painting-supplies', 'drawing-supplies', 'digital-tools', 'crafting-supplies']
  },
  {
    name: 'Accessories',
    categories: ['art-books', 'frames', 'other']
  }
];

// Helper function to get category by value
export function getCategoryByValue(value: string): CategoryItem | undefined {
  return LISTING_CATEGORIES.find(cat => cat.value === value);
}

// Helper function to get category label
export function getCategoryLabel(value: string): string {
  const category = getCategoryByValue(value);
  return category ? category.label : value;
}

// Helper function to get category icon
export function getCategoryIcon(value: string): string {
  const category = getCategoryByValue(value);
  return category ? category.icon : 'category';
}

// Helper function to get category color
export function getCategoryColor(value: string): string {
  const category = getCategoryByValue(value);
  return category ? category.color : 'gray';
}
