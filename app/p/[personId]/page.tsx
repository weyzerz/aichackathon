import PartyApp from "@/components/PartyApp";

export default async function PersonPage({
  params,
}: {
  params: Promise<{ personId: string }>;
}) {
  const { personId } = await params;
  return <PartyApp personId={decodeURIComponent(personId)} />;
}
