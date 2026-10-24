// Late binding for what the engine calls but doesn't own, so modules never
// import upwards: classes defined later in the engine (UIBox, used by Node's
// popups) and functions provided by higher layers (tooltips, sounds hooks).
export const classes: { UIBox?: any } = {};

export const hooks: {
  /** create_popup_UIBox_tooltip (shared/ui) */
  create_popup_UIBox_tooltip?: (tooltip: any) => any;
  /** create_UIBox_detailed_tooltip (entities/card) */
  create_UIBox_detailed_tooltip?: (center: any) => any;
  /** is this node a Card (entities/card) */
  is_card?: (node: any) => boolean;
} = {};
