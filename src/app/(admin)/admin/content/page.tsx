import { adminListDecks } from "@/server/actions/admin/decks";
import { adminListCards } from "@/server/actions/admin/cards";
import { adminListThemes } from "@/server/actions/admin/themes";
import { adminListTags } from "@/server/actions/admin/tags";
import { adminListCategories } from "@/server/actions/admin/categories";
import { adminListPrompts } from "@/server/actions/admin/prompts";
import { adminListJourneys } from "@/server/actions/admin/journeys";
import { ContentView } from "./_components/content-view";

export default async function AdminContentPage() {
  const [cards, decks, journeys, prompts, categories, tags, themes] =
    await Promise.all([
      adminListCards({ take: 50 }),
      adminListDecks({ take: 50 }),
      adminListJourneys({ take: 50 }),
      adminListPrompts({ take: 50 }),
      adminListCategories({ take: 50 }),
      adminListTags({ take: 50 }),
      adminListThemes({ take: 50 }),
    ]);

  return (
    <ContentView
      cards={cards}
      decks={decks}
      journeys={journeys}
      prompts={prompts}
      categories={categories}
      tags={tags}
      themes={themes}
    />
  );
}
