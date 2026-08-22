export type AdminActionType =
  | "create-link"
  | "update-link"
  | "create-folder"
  | "move-link"
  | "delete-link";

export type AdminActionDefinition = {
  type: AdminActionType;
  title: string;
  description: string;
  isDestructive?: boolean;
  triggers: string[];
};

export const ADMIN_ACTION_DEFINITIONS: AdminActionDefinition[] = [
  {
    type: "create-link",
    title: "Create a Link",
    description: "Conversational step-by-step workflow to configure and publish a new short link",
    triggers: [
      "create a link",
      "create link",
      "new link",
      "add link",
      "make a link",
      "short link",
    ],
  },
  {
    type: "update-link",
    title: "Update a Link",
    description: "Modify destination URL, title, schedule, or password for an existing link",
    triggers: [
      "update a link",
      "update link",
      "edit a link",
      "edit link",
      "modify link",
      "change link",
    ],
  },
  {
    type: "create-folder",
    title: "Create a Folder",
    description: "Add a new organizational category folder for district short links",
    triggers: [
      "create a folder",
      "create folder",
      "new folder",
      "add folder",
      "make a folder",
    ],
  },
  {
    type: "move-link",
    title: "Move Link to Folder",
    description: "Reorganize a short link into a different category folder",
    triggers: [
      "move link",
      "move a link",
      "move link to folder",
      "move this link inside of a folder to another one",
      "organize link",
    ],
  },
  {
    type: "delete-link",
    title: "Delete a Link",
    description: "Permanently remove a short link (requires explicit confirmation)",
    isDestructive: true,
    triggers: [
      "delete a link",
      "delete link",
      "remove a link",
      "remove link",
    ],
  },
];

export function detectAdminActionIntent(query: string): AdminActionDefinition | null {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return null;

  for (const action of ADMIN_ACTION_DEFINITIONS) {
    if (action.triggers.some((trigger) => normalized.includes(trigger) || trigger.includes(normalized))) {
      return action;
    }
  }
  return null;
}
