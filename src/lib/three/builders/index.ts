import type { Group } from 'three';
import type { ModelId } from '../../../config/models';
import * as E from './earrings';
import * as F from './face';
import * as N from './necklaces';
import * as X from './extra';

/** Procedural source for every GLB in /public/models (and runtime fallback). */
export const MODEL_BUILDERS: Record<ModelId, () => Group> = {
  'stud-solitaire': E.studSolitaire,
  'stud-gold-flower': E.studGoldFlower,
  'hoop-gold': E.hoopGold,
  'hoop-diamond-huggie': E.hoopDiamondHuggie,
  'jhumka-temple': E.jhumkaTemple,
  'drop-sapphire-halo': E.dropSapphireHalo,
  'chandbali-kundan': E.chandbaliKundan,
  'nosepin-diamond': F.nosePinDiamond,
  'nosering-gold': F.noseRingGold,
  'nath-bridal': F.nathBridal,
  'tikka-kundan': F.tikkaKundan,
  'tikka-diamond-drop': F.tikkaDiamondDrop,
  'necklace-diamond-riviera': N.necklaceDiamondRiviera,
  'necklace-temple-gold': N.necklaceTempleGold,
  'choker-kundan': N.chokerKundan,
  'necklace-pearl-strand': N.necklacePearlStrand,
  'chain-cable-gold': N.chainCableGold,
  'chain-rope-gold': N.chainRopeGold,
  'chain-box-white': N.chainBoxWhite,
  'pendant-solitaire': N.pendantSolitaire,
  'pendant-ruby-drop': N.pendantRubyDrop,
  'pendant-lotus-gold': N.pendantLotusGold,
  'pearl-drop': X.pearlDrop,
  'pearl-stud': X.pearlStud,
  'gold-ball-stud': X.goldBallStud,
  'statement-chandelier': X.statementChandelier,
  'meenakari-drop': X.meenakariDrop,
  'nosepin-solitaire': X.nosePinSolitaire,
  'nosepin-ruby-flower': X.nosePinRubyFlower,
  'layered-necklace': X.layeredNecklace,
  'rani-haar': X.raniHaar,
  'diamond-collar': X.diamondCollar,
  'pendant-emerald-oval': X.pendantEmeraldOval,
  'matha-patti': X.mathaPatti,
};

export function buildModel(id: ModelId): Group {
  const build = MODEL_BUILDERS[id];
  if (!build) throw new Error(`Unknown model ${id}`);
  return build();
}
