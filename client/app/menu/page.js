import MenuBrowse from "@/components/MenuBrowse";

export default function MenuPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <header className="mb-8">
        <h1 className="text-3xl font-bold">Menu</h1>
        <p className="mt-2 text-base-content/70">
          Seasonal dishes available to order when you are signed in.
        </p>
      </header>
      <MenuBrowse />
    </div>
  );
}
