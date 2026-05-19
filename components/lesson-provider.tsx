"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";
import type { Lesson, LangKey, LessonAnnotation } from "@/lib/lessons/types";

type LessonContextValue = {
  lesson: Lesson;
  activeLang: LangKey;
  setActiveLang: (lang: LangKey) => void;
  activeAnnotationId: string | null;
  pinAnnotation: (id: string) => void;
  clearAnnotation: () => void;
  findAnnotation: (id: string) => {
    lang: LangKey;
    annotation: LessonAnnotation;
    code: string;
    meta: string;
    shikiLang: string;
    title?: string;
  } | null;
};

const LessonContext = createContext<LessonContextValue | null>(null);

export function LessonProvider({
  lesson,
  initialLang,
  children,
}: {
  lesson: Lesson;
  initialLang: LangKey;
  children: React.ReactNode;
}) {
  const [activeLang, setActiveLang] = useState<LangKey>(initialLang);
  const [activeAnnotationId, setActiveAnnotationId] = useState<string | null>(null);

  const pinAnnotation = useCallback((id: string) => {
    setActiveAnnotationId(id);
  }, []);

  const clearAnnotation = useCallback(() => {
    setActiveAnnotationId(null);
  }, []);

  const findAnnotation = useCallback<LessonContextValue["findAnnotation"]>(
    (id) => {
      for (const code of lesson.codes) {
        const match = code.annotations.find((a) => a.id === id);
        if (match) {
          return {
            lang: code.lang,
            annotation: match,
            code: code.code,
            meta: code.meta,
            shikiLang: code.shikiLang,
            title: code.title,
          };
        }
      }
      return null;
    },
    [lesson],
  );

  const value = useMemo(
    () => ({
      lesson,
      activeLang,
      setActiveLang,
      activeAnnotationId,
      pinAnnotation,
      clearAnnotation,
      findAnnotation,
    }),
    [lesson, activeLang, activeAnnotationId, pinAnnotation, clearAnnotation, findAnnotation],
  );

  return <LessonContext.Provider value={value}>{children}</LessonContext.Provider>;
}

export function useLesson(): LessonContextValue {
  const ctx = useContext(LessonContext);
  if (!ctx) throw new Error("useLesson must be used within LessonProvider");
  return ctx;
}
