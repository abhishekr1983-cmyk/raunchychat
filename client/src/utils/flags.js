const FLAG_MAP = {
  'India': '🇮🇳', 'United States': '🇺🇸', 'USA': '🇺🇸',
  'United Kingdom': '🇬🇧', 'UK': '🇬🇧', 'Canada': '🇨🇦',
  'Australia': '🇦🇺', 'Germany': '🇩🇪', 'France': '🇫🇷',
  'Brazil': '🇧🇷', 'Pakistan': '🇵🇰', 'Mexico': '🇲🇽',
  'South Africa': '🇿🇦', 'Philippines': '🇵🇭', 'Indonesia': '🇮🇩',
  'Nigeria': '🇳🇬', 'Japan': '🇯🇵', 'China': '🇨🇳',
  'Russia': '🇷🇺', 'Italy': '🇮🇹', 'Spain': '🇪🇸',
  'Argentina': '🇦🇷', 'Bangladesh': '🇧🇩', 'Egypt': '🇪🇬',
  'Turkey': '🇹🇷', 'Thailand': '🇹🇭', 'Vietnam': '🇻🇳',
  'Malaysia': '🇲🇾', 'Singapore': '🇸🇬', 'UAE': '🇦🇪',
  'Saudi Arabia': '🇸🇦', 'Kenya': '🇰🇪', 'Ghana': '🇬🇭',
  'Netherlands': '🇳🇱', 'Sweden': '🇸🇪', 'Norway': '🇳🇴',
  'Poland': '🇵🇱', 'Ukraine': '🇺🇦', 'Romania': '🇷🇴',
  'New Zealand': '🇳🇿', 'Ireland': '🇮🇪', 'Portugal': '🇵🇹',
};

export function getFlag(country) {
  return FLAG_MAP[country] || '🌍';
}
