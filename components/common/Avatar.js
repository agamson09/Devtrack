import { useState } from 'react'

const DICEBEAR_STYLES = ['lorelei', 'bottts', 'pixel-art', 'avataaars', 'fun-emoji', 'identicon', 'open-peeps', 'personas']

const ROLE_DEFAULT_STYLE = {
  admin: 'bottts',
  it_support: 'adventurer',
  member: 'lorelei',
}

const STYLE_CUSTOMIZATION = {
  'open-peeps': {
    label: 'Open Peeps',
    variants: [
      { key: 'headVariant', label: 'Hair Style', options: ['short1','short2','short3','short4','short5','long','longCurly','longBangs','curly','mohawk','mohawk2','bun','bun2','buns','bangs','bangs2','afro','longAfro','flatTop','flatTopLong','cornrows','cornrows2','dreads1','dreads2','pomp','shaved1','shaved2','shaved3','twists','twists2','hatBeanie','hatHip','hijab','turban','noHair1','noHair2','noHair3','grayBun','grayMedium','grayShort','medium1','medium2','medium3','mediumBangs','mediumBangs2','mediumBangs3','mediumStraight'] },
      { key: 'expressionVariant', label: 'Expression', options: ['blank','calm','smile','smileBig','smileLOL','smileTeethGap','cheeky','cute','serious','concerned','tired','hectic','awe','rage','veryAngry','angryWithFang','suspicious','fear','concernedFear','solemn','driven','lovingGrin1','lovingGrin2','explaining','eyesClosed','eatingHappy','cyclops','old','monster'] },
      { key: 'facialHairVariant', label: 'Facial Hair', options: ['none','chin','full','full2','full3','full4','goatee1','goatee2','moustache1','moustache2','moustache3','moustache4','moustache5','moustache6','moustache7','moustache8','moustache9'], clearable: true },
      { key: 'accessoriesVariant', label: 'Accessories', options: ['none','eyepatch','glasses','glasses2','glasses3','glasses4','glasses5','sunglasses','sunglasses2'], clearable: true },
    ],
    colors: [
      { key: 'skinColor', label: 'Skin', colors: ['ffd5b8','f0c8a0','d4a574','c68642','8d5524','ffdbac','e8b898','c9946e','a0714f'] },
      { key: 'clothingColor', label: 'Clothes', colors: ['ffffff','ff6b6b','4ecdc4','45b7d1','96ceb4','ffeaa7','dfe6e9','fd79a8','6c5ce7','00b894','e17055','0984e3'] },
      { key: 'headContrastColor', label: 'Hair Accent', colors: ['2d3436','636e72','b2bec3','d63031','e17055','fdcb6e','00b894','0984e3','6c5ce7','fab1a0','74b9ff'] },
    ]
  },
  'avataaars': {
    label: 'Avataaars',
    variants: [
      { key: 'topVariant', label: 'Hair Style', options: ['shortFlat','shortRound','shortWaved','shortCurly','bigHair','bob','bobBangs','bun','curly','curvy','dreads','dreads01','dreads02','frida','frizzle','fro','froBand','hat','hijab','longButNotTooLong','miaWallace','shaggy','shaggyMullet','shavedSides','sides','straight01','straight02','straightAndStrand','theCaesar','theCaesarAndSidePart','turban','winterHat1','winterHat02','winterHat03','winterHat04'] },
      { key: 'eyesVariant', label: 'Eyes', options: ['default','cry','closed','eyeRoll','happy','hearts','side','squint','surprised','wink','winkWacky','xDizzy'] },
      { key: 'mouthVariant', label: 'Mouth', options: ['default','smile','tongue','twinkle','serious','concerned','disbelief','eating','grimace','sad','screamOpen','vomit'] },
      { key: 'accessoriesVariant', label: 'Accessories', options: ['none','eyepatch','kurt','prescription01','prescription02','round','sunglasses','wayfarers'], clearable: true },
      { key: 'facialHairVariant', label: 'Facial Hair', options: ['none','beardLight','beardMajestic','beardMedium','moustacheFancy','moustacheMagnum'], clearable: true },
      { key: 'clothesVariant', label: 'Clothes', options: ['shirtCrewNeck','shirtScoopNeck','shirtVNeck','blazerAndShirt','blazerAndSweater','collarAndSweater','graphicShirt','hoodie','overall'] },
    ],
    colors: [
      { key: 'skinColor', label: 'Skin', colors: ['ffd5b8','f0c8a0','d4a574','c68642','8d5524','ffdbac','e8b898','c9946e'] },
      { key: 'hairColor', label: 'Hair', colors: ['2d3436','636e72','b2bec3','d63031','e17055','fdcb6e','00b894','0984e3','6c5ce7','fab1a0','74b9ff','a05000'] },
      { key: 'clothesColor', label: 'Clothes', colors: ['ffffff','2d3436','ff6b6b','4ecdc4','45b7d1','96ceb4','ffeaa7','fd79a8','6c5ce7','00b894','e17055','0984e3'] },
      { key: 'accessoriesColor', label: 'Glasses', colors: ['2d3436','636e72','b2bec3','d63031','e17055','fdcb6e','0984e3'] },
    ]
  },
  'lorelei': {
    label: 'Lorelei',
    variants: [
      { key: 'hairVariant', label: 'Hair Style', options: ['variant01','variant02','variant03','variant04','variant05','variant06','variant07','variant08','variant09','variant10','variant11','variant12','variant13','variant14','variant15','variant16','variant17','variant18','variant19','variant20','variant21','variant22','variant23','variant24','variant25','variant26','variant27','variant28','variant29','variant30','variant31','variant32','variant33','variant34','variant35','variant36','variant37','variant38','variant39','variant40','variant41','variant42','variant43','variant44','variant45','variant46','variant47','variant48'] },
      { key: 'eyesVariant', label: 'Eyes', options: ['variant01','variant02','variant03','variant04','variant05','variant06','variant07','variant08','variant09','variant10','variant11','variant12','variant13','variant14','variant15','variant16','variant17','variant18','variant19','variant20','variant21','variant22','variant23','variant24'] },
      { key: 'mouthVariant', label: 'Mouth', options: ['happy01','happy02','happy03','happy04','happy05','happy06','happy07','happy08','happy09','happy10','happy11','happy12','happy13','happy14','happy15','happy16','happy17','happy18','sad01','sad02','sad03','sad04','sad05','sad06','sad07','sad08','sad09'] },
      { key: 'glassesVariant', label: 'Glasses', options: ['none','variant01','variant02','variant03','variant04','variant05'], clearable: true },
      { key: 'beardVariant', label: 'Beard', options: ['none','variant01','variant02'], clearable: true },
    ],
    colors: [
      { key: 'skinColor', label: 'Skin', colors: ['ffd5b8','f0c8a0','d4a574','c68642','8d5524','ffdbac'] },
      { key: 'hairColor', label: 'Hair', colors: ['2d3436','636e72','b2bec3','d63031','e17055','fdcb6e','00b894','0984e3','6c5ce7','a05000'] },
      { key: 'backgroundColor', label: 'Background', colors: ['ffffff','b6e3f4','c0aede','d1d4f9','ffd5dc','ffdfbf','f0f0f0'] },
    ]
  },
  'bottts': {
    label: 'Bottts',
    variants: [
      { key: 'headVariant', label: 'Head Shape', options: ['round01','round02','square01','square02','square03','square04'] },
      { key: 'eyesVariant', label: 'Eyes', options: ['bulging','dizzy','eva','frame1','frame2','glow','happy','hearts','robocop','round','roundFrame01','roundFrame02','sensor','shade01'] },
      { key: 'mouthVariant', label: 'Mouth', options: ['bite','diagram','grill01','grill02','grill03','smile01','smile02','square01','square02'] },
      { key: 'topVariant', label: 'Top', options: ['antenna','antennaCrooked','bulb01','glowingBulb01','glowingBulb02','horns','lights','pyramid','radar'] },
      { key: 'textureVariant', label: 'Texture', options: ['camo01','camo02','circuits','dirty01','dirty02','dots','grunge01','grunge02'] },
    ],
    colors: [
      { key: 'baseColor', label: 'Body', colors: ['0984e3','6c5ce7','00b894','e17055','d63031','fdcb6e','636e72','2d3436','fab1a0','74b9ff'] },
      { key: 'backgroundColor', label: 'Background', colors: ['ffffff','b6e3f4','c0aede','d1d4f9','ffd5dc','ffdfbf'] },
    ]
  },
  'pixel-art': {
    label: 'Pixel Art',
    variants: [
      { key: 'hairVariant', label: 'Hair', options: ['short01','short02','short03','short04','short05','short06','short07','short08','short09','short10','short11','short12','short13','short14','short15','short16','short17','short18','short19','short20','short21','short22','short23','short24','long01','long02','long03','long04','long05','long06','long07','long08','long09','long10','long11','long12','long13','long14','long15','long16','long17','long18','long19','long20','long21'] },
      { key: 'eyesVariant', label: 'Eyes', options: ['variant01','variant02','variant03','variant04','variant05','variant06','variant07','variant08','variant09','variant10','variant11','variant12'] },
      { key: 'mouthVariant', label: 'Mouth', options: ['happy01','happy02','happy03','happy04','happy05','happy06','happy07','happy08','happy09','happy10','happy11','happy12','happy13','sad01','sad02','sad03','sad04','sad05','sad06','sad07','sad08','sad09','sad10'] },
      { key: 'clothesVariant', label: 'Clothes', options: ['variant01','variant02','variant03','variant04','variant05','variant06','variant07','variant08','variant09','variant10','variant11','variant12','variant13','variant14','variant15','variant16','variant17','variant18','variant19','variant20','variant21','variant22','variant23'] },
      { key: 'glassesVariant', label: 'Glasses', options: ['none','dark01','dark02','dark03','dark04','dark05','dark06','dark07','light01','light02','light03','light04','light05','light06','light07'], clearable: true },
    ],
    colors: [
      { key: 'skinColor', label: 'Skin', colors: ['ffd5b8','f0c8a0','d4a574','c68642','8d5524','ffdbac'] },
      { key: 'hairColor', label: 'Hair', colors: ['2d3436','636e72','d63031','e17055','fdcb6e','00b894','0984e3','a05000'] },
      { key: 'clothingColor', label: 'Clothes', colors: ['ffffff','2d3436','ff6b6b','4ecdc4','45b7d1','fd79a8','6c5ce7','00b894','e17055','0984e3'] },
    ]
  },
  'fun-emoji': {
    label: 'Fun Emoji',
    variants: [
      { key: 'eyesVariant', label: 'Eyes', options: ['closed','closed2','crying','cute','glasses','love','pissed','plain','sad','shades','sleepClose','stars','tearDrop','wink','wink2'] },
      { key: 'mouthVariant', label: 'Mouth', options: ['cute','drip','faceMask','kissHeart','lilSmile','pissed','plain','sad','shout','shy','sick','smileLol','smileTeeth','tongueOut','wideSmile'] },
    ],
    colors: [
      { key: 'backgroundColor', label: 'Background', colors: ['ffffff','b6e3f4','c0aede','d1d4f9','ffd5dc','ffdfbf','ff6b6b','4ecdc4','45b7d1','ffeaa7'] },
    ]
  },
  'identicon': {
    label: 'Identicon',
    variants: [],
    colors: []
  },
  'personas': {
    label: 'Personas',
    variants: [
      { key: 'hairVariant', label: 'Hair', options: ['bald','balding','beanie','bobBangs','bobCut','bunUndercut','buzzcut','cap','curly','curlyBun','curlyHighTop','extraLong','fade','long','mohawk','pigtails','shortCombover','shortComboverChops','sideShave','straightBun'] },
      { key: 'eyesVariant', label: 'Eyes', options: ['glasses','happy','open','sleep','sunglasses','wink'] },
      { key: 'mouthVariant', label: 'Mouth', options: ['bigSmile','frown','lips','pacifier','smile','smirk','surprise'] },
      { key: 'facialHairVariant', label: 'Facial Hair', options: ['none','beardMustache','goatee','pyramid','shadow','soulPatch','walrus'], clearable: true },
    ],
    colors: [
      { key: 'skinColor', label: 'Skin', colors: ['ffd5b8','f0c8a0','d4a574','c68642','8d5524','ffdbac'] },
      { key: 'hairColor', label: 'Hair', colors: ['2d3436','636e72','b2bec3','d63031','e17055','fdcb6e','00b894','0984e3','a05000'] },
      { key: 'clothingColor', label: 'Clothes', colors: ['ffffff','2d3436','ff6b6b','4ecdc4','45b7d1','fd79a8','6c5ce7','00b894','e17055','0984e3'] },
    ]
  },
}

function getDiceBearUrl(name, style, seed, options) {
  const s = style || ROLE_DEFAULT_STYLE.admin || 'lorelei'
  const finalSeed = seed || name || 'unknown'
  const params = new URLSearchParams({ seed: finalSeed, size: '128' })
  let opts = options
  if (typeof opts === 'string') {
    try { opts = JSON.parse(opts) } catch { opts = null }
  }
  if (opts && typeof opts === 'object' && !Array.isArray(opts)) {
    for (const [key, value] of Object.entries(opts)) {
      if (value) params.set(key, value)
    }
  }
  return `https://api.dicebear.com/10.x/${s}/svg?${params.toString()}`
}

export default function Avatar({ name, src, avatarStyle, avatarSeed, avatarOptions, size = 'md', className = '' }) {
  const [imgFailed, setImgFailed] = useState(false)

  const sizes = {
    sm: 'w-8 h-8 text-xs',
    md: 'w-10 h-10 text-sm',
    lg: 'w-12 h-12 text-base',
    xl: 'w-16 h-16 text-lg',
  }

  const px = { sm: 32, md: 40, lg: 48, xl: 64 }

  const getInitials = (name) => {
    if (!name) return '?'
    return name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)
  }

  const colors = ['bg-indigo-600','bg-purple-600','bg-pink-600','bg-blue-600','bg-teal-600','bg-orange-600']
  const colorIndex = name ? name.charCodeAt(0) % colors.length : 0

  if (src && !imgFailed) {
    return <img src={src} alt={name} width={px[size]} height={px[size]} className={`${sizes[size]} rounded-full object-cover ${className}`} onError={() => setImgFailed(true)} />
  }

  if (!imgFailed) {
    const diceBearUrl = getDiceBearUrl(name, avatarStyle, avatarSeed, avatarOptions)
    return <img src={diceBearUrl} alt={name} width={px[size]} height={px[size]} className={`${sizes[size]} rounded-full ${className}`} onError={() => setImgFailed(true)} />
  }

  return (
    <div className={`${sizes[size]} ${colors[colorIndex]} rounded-full flex items-center justify-center font-semibold text-white ${className}`}>
      {getInitials(name)}
    </div>
  )
}

export { DICEBEAR_STYLES, ROLE_DEFAULT_STYLE, STYLE_CUSTOMIZATION, getDiceBearUrl }
