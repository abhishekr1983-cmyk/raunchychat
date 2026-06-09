/**
 * Generate a unique, consistent gradient background for a user's avatar
 * based on their username. Each name always gets the same color pair.
 */
export function getAvatarStyle(username = '?') {
  let hash = 0;
  for (let i = 0; i < username.length; i++) {
    hash = username.charCodeAt(i) + ((hash << 5) - hash);
    hash = hash & hash; // convert to 32-bit int
  }
  const h1 = Math.abs(hash) % 360;
  const h2 = (h1 + 45) % 360;
  return {
    background: `linear-gradient(135deg, hsl(${h1},65%,55%) 0%, hsl(${h2},65%,38%) 100%)`,
  };
}

/** Single letter initial, upper-cased */
export function getInitial(username = '?') {
  return (username[0] || '?').toUpperCase();
}
