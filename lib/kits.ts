export type DismantleAllocationComponent = {
  componentProductId: string;
  componentQty: number;
  componentCostPrice: number;
};

export type DismantleAllocationResult = {
  componentProductId: string;
  componentQty: number;
  allocationShare: number;
  inboundUnitCost: number;
  totalAllocatedCostPerKit: number;
};

export function calculateDismantleAllocations(input: {
  kitAvgUnitCost: number;
  components: DismantleAllocationComponent[];
}): DismantleAllocationResult[] {
  const safeComponents = input.components
    .filter((component) => component.componentQty > 0)
    .map((component) => ({
      ...component,
      extendedCostBasis: Math.max(component.componentCostPrice, 0) * component.componentQty,
    }));

  const totalExtendedCostBasis = safeComponents.reduce(
    (sum, component) => sum + component.extendedCostBasis,
    0
  );
  const totalComponentUnits = safeComponents.reduce(
    (sum, component) => sum + component.componentQty,
    0
  );

  return safeComponents.map((component) => {
    const allocationShare =
      totalExtendedCostBasis > 0
        ? component.extendedCostBasis / totalExtendedCostBasis
        : totalComponentUnits > 0
          ? component.componentQty / totalComponentUnits
          : 0;
    const totalAllocatedCostPerKit = input.kitAvgUnitCost * allocationShare;
    const inboundUnitCost =
      component.componentQty > 0
        ? totalAllocatedCostPerKit / component.componentQty
        : 0;

    return {
      componentProductId: component.componentProductId,
      componentQty: component.componentQty,
      allocationShare,
      inboundUnitCost,
      totalAllocatedCostPerKit,
    };
  });
}
