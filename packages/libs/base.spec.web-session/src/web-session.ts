import { Spec } from "@ctrl/arch.utils.spec-builder"
import {
  CreateSession, CloseSession, ActivateSession, Navigate, UrlCommitted,
  TitleChanged, NavigationFailed,
} from "@ctrl/base.op.browsing"
import { Effects } from "@ctrl/base.op.browsing"

export const WebSessionSpec = Spec.make("web-session", {
  mode: "instance", domain: "session", version: 1,
})
  .initial("idle")
  .triggers(CreateSession)
  .terminalOn(CloseSession)
  .state("idle", (s) => s
    .on(CreateSession, "browsing", {
      effects: [Effects.SESSION_CREATE],
    })
    .on(Navigate, "loading", {
      guards: [Effects.URL_IS_VALID],
      effects: [Effects.NAV_START],
    })
  )
  .state("loading", (s) => s
    .on(UrlCommitted, "browsing", {
      effects: [
        Effects.SESSION_UPDATE_URL,
        Effects.SESSION_UPDATE_TITLE,
        Effects.SESSION_UPDATE_FAVICON,
        Effects.HISTORY_RECORD,
      ],
    })
    .on(NavigationFailed, "error", {
      effects: [Effects.SESSION_SET_ERROR],
    })
  )
  .state("browsing", (s) => s
    .on(Navigate, "loading", {
      guards: [Effects.URL_IS_VALID],
      effects: [Effects.NAV_START],
    })
    .on(ActivateSession, "browsing", {
      effects: [Effects.SESSION_ACTIVATE],
    })
    .on(TitleChanged, "browsing", {
      effects: [Effects.SESSION_UPDATE_TITLE],
    })
    .on(CloseSession, "closed", {
      effects: [Effects.SESSION_CLOSE],
    })
  )
  .state("error", (s) => s
    .on(Navigate, "loading", {
      effects: [Effects.NAV_START],
    })
    .on(CloseSession, "closed")
  )
  .state("closed")
  .build()
