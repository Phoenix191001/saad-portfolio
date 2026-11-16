// Bundled into assets/admin/editor-bundle.js (see package.json: npm run build).
import { Editor } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import Link from "@tiptap/extension-link";
import Image from "@tiptap/extension-image";
import Youtube from "@tiptap/extension-youtube";
import Placeholder from "@tiptap/extension-placeholder";
import CharacterCount from "@tiptap/extension-character-count";
import Highlight from "@tiptap/extension-highlight";
import TextStyle from "@tiptap/extension-text-style";
import Color from "@tiptap/extension-color";
import TextAlign from "@tiptap/extension-text-align";
import Table from "@tiptap/extension-table";
import TableRow from "@tiptap/extension-table-row";
import TableHeader from "@tiptap/extension-table-header";
import TableCell from "@tiptap/extension-table-cell";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
import CodeBlockLowlight from "@tiptap/extension-code-block-lowlight";
import { common, createLowlight } from "lowlight";

const lowlight = createLowlight(common);

export function createEditor({ element, content, placeholder, onChange }) {
  return new Editor({
    element,
    content: content || "",
    extensions: [
      StarterKit.configure({ codeBlock: false, heading: { levels: [1, 2, 3, 4] } }),
      Underline,
      Link.configure({
        openOnClick: false,
        autolink: true,
        HTMLAttributes: { rel: "noopener noreferrer nofollow", target: "_blank" },
      }),
      Image.configure({ allowBase64: false }),
      Youtube.configure({
        nocookie: true,
        controls: true,
        modestBranding: true,
        width: 640,
        height: 360,
      }),
      Placeholder.configure({ placeholder: placeholder || "Write your story. Type / for commands." }),
      CharacterCount,
      Highlight,
      TextStyle,
      Color,
      TextAlign.configure({ types: ["heading", "paragraph"] }),
      Table.configure({ resizable: true }),
      TableRow,
      TableHeader,
      TableCell,
      TaskList,
      TaskItem.configure({ nested: true }),
      CodeBlockLowlight.configure({ lowlight }),
    ],
    onUpdate: ({ editor }) => onChange && onChange(editor),
    onSelectionUpdate: ({ editor }) => onChange && onChange(editor, true),
  });
}

