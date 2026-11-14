export function writesLedgerRow({
  seatKinds,
  playBegan,
  endedBy,
}: {
  seatKinds: Readonly<Record<"A" | "B", "guest" | "account" | undefined>>;
  playBegan: boolean;
  endedBy: "action" | "claim" | null;
}): boolean {
  return (
    playBegan &&
    endedBy !== null &&
    seatKinds.A === "account" &&
    seatKinds.B === "account"
  );
}
