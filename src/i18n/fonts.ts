// Handwriting fonts for Chinese and Japanese, loaded only for that language.
// Fontsource splits each into unicode-range slices, so a page only downloads
// the glyphs it shows. style.css adds them to the font stacks per :lang().

import { lang } from '.';

if (lang === 'zh') void import('@fontsource/zcool-kuaile/400.css');
if (lang === 'ja') void import('@fontsource/yomogi/400.css');
