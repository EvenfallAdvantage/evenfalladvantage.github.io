// Shared Cesium ref types used by all layer sub-hooks.
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- Cesium viewer/module refs have no published TS types
export type CesiumRef = React.MutableRefObject<any>;
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- Cesium entity collections keyed by layer name
export type EntityGroupsRef = React.MutableRefObject<Record<string, any>>;
