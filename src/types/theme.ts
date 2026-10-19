export type SurfaceStyle = 'default' | 'flat' | 'bordered' | 'glassmorphism' | 'parchment'
export type CornerRadius = 'none' | 'sm' | 'md' | 'full'
export type BannerHeight = 'compact' | 'standard' | 'tall'
export type PageBackgroundPattern = 'none' | 'grid' | 'dots' | 'noise'
export type FontFamily = 'sans' | 'serif' | 'mono'
export type FontSizeScale = 'sm' | 'base' | 'lg'

export interface ThemeWidgetsConfig {
  show_bio_card?: boolean
  show_recent_notes?: boolean
  show_pinned_works?: boolean
  show_music_favorites?: boolean
}

export interface ThemePresetConfig {
  primary_color?: string
  surface_style?: SurfaceStyle
  corner_radius?: CornerRadius
  banner_url?: string
  banner_height?: BannerHeight
  banner_overlay_opacity?: number
  page_background_pattern?: PageBackgroundPattern
  font_family?: FontFamily
  font_size_scale?: FontSizeScale
  widgets?: ThemeWidgetsConfig
}

export type ThemeMode = 'preset' | 'custom_css'

export interface UserTheme {
  is_enabled: boolean
  mode: ThemeMode
  preset_config: ThemePresetConfig
  custom_css?: string
  sanitized_css: string
}

export interface UpdateThemePayload {
  is_enabled: boolean
  mode: ThemeMode
  preset_config: ThemePresetConfig
  custom_css?: string
}
