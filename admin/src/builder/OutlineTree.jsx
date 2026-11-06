import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import {
  BookOpen,
  FileText,
  GripVertical,
  ListChecks,
  MonitorPlay,
  Plus,
  Shield,
} from 'lucide-react';
import { LESSON_TYPE_LABELS } from '../lib/labels.js';

const TYPE_ICON = { video: MonitorPlay, text: BookOpen, document: FileText, practice: ListChecks };

/**
 * The outline (DESIGN §7): modules and lessons in order, drag to reorder with the mouse, keyboard or touch.
 * Each drop calls the server's reorder endpoint; the server rejects anything that is not a full reorder.
 */
export default function OutlineTree({
  course,
  selection,
  onSelect,
  onReorderModules,
  onReorderLessons,
  onAddModule,
  onAddLesson,
}) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );
  const modules = course.modules;

  const endModules = (event) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const from = modules.findIndex((m) => m.id === active.id);
    const to = modules.findIndex((m) => m.id === over.id);
    onReorderModules(arrayMove(modules, from, to).map((m) => m.id));
  };

  return (
    <nav aria-label="Course outline" className="flex flex-col gap-sm">
      <button
        type="button"
        onClick={() => onSelect({ kind: 'course' })}
        className={`rounded-md px-md py-sm text-left text-pw-body font-[800] ${selection.kind === 'course' ? 'bg-jade100 text-jade700' : 'text-ink900 hover:bg-bg'}`}
      >
        {course.title || 'Course details'}
      </button>

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={endModules}>
        <SortableContext items={modules.map((m) => m.id)} strategy={verticalListSortingStrategy}>
          {modules.map((m, mi) => (
            <ModuleRow
              key={m.id}
              module={m}
              index={mi}
              selection={selection}
              onSelect={onSelect}
              onReorderLessons={onReorderLessons}
              onAddLesson={onAddLesson}
            />
          ))}
        </SortableContext>
      </DndContext>

      <button
        type="button"
        onClick={onAddModule}
        className="mt-sm flex items-center gap-sm rounded-md border border-dashed border-line px-md py-sm text-pw-small font-[800] text-jade700 hover:bg-jade100"
      >
        <Plus size={16} aria-hidden="true" /> Add module
      </button>
    </nav>
  );
}

function ModuleRow({ module: m, index, selection, onSelect, onReorderLessons, onAddLesson }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: m.id,
  });
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );
  const endLessons = (event) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const from = m.lessons.findIndex((l) => l.id === active.id);
    const to = m.lessons.findIndex((l) => l.id === over.id);
    onReorderLessons(
      m.id,
      arrayMove(m.lessons, from, to).map((l) => l.id)
    );
  };
  const moduleSelected = selection.kind === 'module' && selection.moduleId === m.id;

  return (
    <div
      ref={setNodeRef}
      style={{ transform: transformStyle(transform), transition }}
      className={`rounded-lg border border-line bg-surface ${isDragging ? 'opacity-70 shadow-none' : ''}`}
    >
      <div className="flex items-center gap-xs p-xs">
        <button
          type="button"
          aria-label={`Drag module ${index + 1}`}
          className="cursor-grab rounded-md p-xs text-ink400 hover:text-ink900"
          {...attributes}
          {...listeners}
        >
          <GripVertical size={16} />
        </button>
        <button
          type="button"
          onClick={() => onSelect({ kind: 'module', moduleId: m.id })}
          aria-current={moduleSelected || undefined}
          className={`min-w-0 flex-1 truncate rounded-md px-sm py-xs text-left text-pw-body font-[800] ${moduleSelected ? 'text-jade700' : 'text-ink900'}`}
        >
          {index + 1}. {m.title}
        </button>
      </div>

      <div className="flex flex-col gap-xs px-xs pb-xs pl-lg">
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={endLessons}>
          <SortableContext
            items={m.lessons.map((l) => l.id)}
            strategy={verticalListSortingStrategy}
          >
            {m.lessons.map((l, li) => (
              <LessonRow
                key={l.id}
                lesson={l}
                number={`${index + 1}.${li + 1}`}
                moduleId={m.id}
                selection={selection}
                onSelect={onSelect}
              />
            ))}
          </SortableContext>
        </DndContext>
        <button
          type="button"
          onClick={() => onAddLesson(m.id)}
          className="flex items-center gap-sm rounded-md px-sm py-xs text-left text-pw-small font-[800] text-jade700 hover:bg-jade100"
        >
          <Plus size={14} aria-hidden="true" /> Add lesson
        </button>
        {m.assessment && <AssessmentRow module={m} selection={selection} onSelect={onSelect} />}
      </div>
    </div>
  );
}

function LessonRow({ lesson: l, number, moduleId, selection, onSelect }) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: l.id });
  const Icon = TYPE_ICON[l.type] ?? BookOpen;
  const active = selection.kind === 'lesson' && selection.lessonId === l.id;
  return (
    <div
      ref={setNodeRef}
      style={{ transform: transformStyle(transform), transition }}
      className="flex items-center gap-xs"
    >
      <button
        type="button"
        aria-label={`Drag lesson ${number}`}
        className="cursor-grab rounded-md p-xs text-ink400 hover:text-ink900"
        {...attributes}
        {...listeners}
      >
        <GripVertical size={14} />
      </button>
      <button
        type="button"
        onClick={() => onSelect({ kind: 'lesson', moduleId, lessonId: l.id })}
        aria-current={active || undefined}
        className={`flex min-w-0 flex-1 items-center gap-sm rounded-md px-sm py-xs text-left text-pw-small ${active ? 'bg-jade100 font-[800] text-jade700' : 'text-ink900 hover:bg-bg'}`}
      >
        <Icon size={14} aria-hidden="true" className="shrink-0" />
        <span className="min-w-0 flex-1 truncate">
          {number} {l.title}
        </span>
        <span className="shrink-0 text-ink600">{LESSON_TYPE_LABELS[l.type]}</span>
      </button>
    </div>
  );
}

function AssessmentRow({ module: m, selection, onSelect }) {
  const active = selection.kind === 'assessment' && selection.moduleId === m.id;
  return (
    <button
      type="button"
      onClick={() => onSelect({ kind: 'assessment', moduleId: m.id })}
      aria-current={active || undefined}
      className={`mt-xs flex items-center gap-sm rounded-md px-sm py-xs text-left text-pw-small ${active ? 'bg-amber100 font-[800] text-ink900' : 'text-ink900 hover:bg-bg'}`}
    >
      <Shield size={14} className="shrink-0 text-amber700" aria-hidden="true" />
      <span className="min-w-0 flex-1 truncate">
        Check · {m.assessment.questionCount} question{m.assessment.questionCount === 1 ? '' : 's'}
      </span>
    </button>
  );
}

/** The drag offset as a CSS transform (computed here, so no extra package is needed). */
function transformStyle(t) {
  return t ? `translate3d(${t.x}px, ${t.y}px, 0)` : undefined;
}
