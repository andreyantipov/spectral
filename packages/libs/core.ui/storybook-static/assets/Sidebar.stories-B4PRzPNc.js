import{j as V,c as B,t as e}from"./iframe-oJHCjMSb.js";import{S as H}from"./Sidebar-rB8-Tge6.js";import"./preload-helper-Dp1pzeXC.js";import"./sva-yFf2R5f0.js";var z=e("<span>&#9776;"),o=e("<span>&#9734;"),O=e("<span>&#8634;"),R=e("<span style=color:#f00>&#9679;"),Y=e("<span style=color:#f80>&#9679;"),j=e("<span style=color:#888>&#9679;"),A=e("<div style=height:500px;display:flex;position:relative;background:#1a1a1a><div style=flex:1;display:flex;align-items:center;justify-content:center;color:#666>Page Content"),D=e("<button type=button style=background:none;border:none;color:#888;cursor:pointer;font-size:11px;font-family:inherit>Clear");const d={sessions:()=>z(),bookmarks:()=>o(),history:()=>O()},s=[{id:"sessions",icon:d.sessions(),label:"Sessions"},{id:"bookmarks",icon:d.bookmarks(),label:"Bookmarks"},{id:"history",icon:d.history(),label:"History"}],m=[{id:"yt",icon:R(),label:"YouTube — youtube.com"},{id:"welcome",icon:Y(),label:"Welcome!"},{id:"wiki",icon:j(),label:"Wikipedia — wikipedia.org"}],L=[{id:"gh",icon:o(),label:"GitHub",secondaryLabel:"github.com"},{id:"so",icon:o(),label:"Stack Overflow",secondaryLabel:"stackoverflow.com"},{id:"mdn",icon:o(),label:"MDN Web Docs",secondaryLabel:"developer.mozilla.org"},{id:"hn",icon:o(),label:"Hacker News",secondaryLabel:"news.ycombinator.com"}],F=[{id:"h1",label:"Reddit — reddit.com",secondaryLabel:"2:34 PM"},{id:"h2",label:"BBC — bbc.co.uk",secondaryLabel:"1:15 PM"},{id:"h3",label:"YouTube — youtube.com",secondaryLabel:"12:02 PM"},{id:"h4",label:"Wikipedia — wikipedia.org",secondaryLabel:"Yesterday"}],J={title:"Organisms/Sidebar",component:H,argTypes:{position:{control:"select",options:["left","right"]},float:{control:"boolean"},collapsed:{control:"boolean"},defaultWidth:{control:{type:"range",min:180,max:400}}},decorators:[M=>(()=>{var c=A(),P=c.firstChild;return V(c,B(M,{}),P),c})()]},t={args:{tabs:s,activeTabId:"sessions",items:m,activeItemId:"yt",position:"left",defaultWidth:240}},a={args:{tabs:s,activeTabId:"bookmarks",items:L,position:"left",defaultWidth:240}},i={args:{tabs:s,activeTabId:"history",items:F,position:"left",defaultWidth:260,panelActions:D()}},n={args:{tabs:s,activeTabId:"sessions",items:m,collapsed:!0,position:"left"}},r={args:{tabs:s,activeTabId:"sessions",items:m,activeItemId:"yt",float:!0,position:"left",defaultWidth:260}},l={args:{tabs:s,activeTabId:"bookmarks",items:L,position:"right",defaultWidth:240}};var b,p,u;t.parameters={...t.parameters,docs:{...(b=t.parameters)==null?void 0:b.docs,source:{originalSource:`{
  args: {
    tabs: defaultTabs,
    activeTabId: "sessions",
    items: sessionItems,
    activeItemId: "yt",
    position: "left",
    defaultWidth: 240
  }
}`,...(u=(p=t.parameters)==null?void 0:p.docs)==null?void 0:u.source}}};var f,y,k;a.parameters={...a.parameters,docs:{...(f=a.parameters)==null?void 0:f.docs,source:{originalSource:`{
  args: {
    tabs: defaultTabs,
    activeTabId: "bookmarks",
    items: bookmarkItems,
    position: "left",
    defaultWidth: 240
  }
}`,...(k=(y=a.parameters)==null?void 0:y.docs)==null?void 0:k.source}}};var g,h,I;i.parameters={...i.parameters,docs:{...(g=i.parameters)==null?void 0:g.docs,source:{originalSource:`{
  args: {
    tabs: defaultTabs,
    activeTabId: "history",
    items: historyItems,
    position: "left",
    defaultWidth: 260,
    panelActions: <button type="button" style={{
      background: "none",
      border: "none",
      color: "#888",
      cursor: "pointer",
      "font-size": "11px",
      "font-family": "inherit"
    }}>
                Clear
            </button>
  }
}`,...(I=(h=i.parameters)==null?void 0:h.docs)==null?void 0:I.source}}};var v,T,W;n.parameters={...n.parameters,docs:{...(v=n.parameters)==null?void 0:v.docs,source:{originalSource:`{
  args: {
    tabs: defaultTabs,
    activeTabId: "sessions",
    items: sessionItems,
    collapsed: true,
    position: "left"
  }
}`,...(W=(T=n.parameters)==null?void 0:T.docs)==null?void 0:W.source}}};var w,S,_;r.parameters={...r.parameters,docs:{...(w=r.parameters)==null?void 0:w.docs,source:{originalSource:`{
  args: {
    tabs: defaultTabs,
    activeTabId: "sessions",
    items: sessionItems,
    activeItemId: "yt",
    float: true,
    position: "left",
    defaultWidth: 260
  }
}`,...(_=(S=r.parameters)==null?void 0:S.docs)==null?void 0:_.source}}};var $,x,C;l.parameters={...l.parameters,docs:{...($=l.parameters)==null?void 0:$.docs,source:{originalSource:`{
  args: {
    tabs: defaultTabs,
    activeTabId: "bookmarks",
    items: bookmarkItems,
    position: "right",
    defaultWidth: 240
  }
}`,...(C=(x=l.parameters)==null?void 0:x.docs)==null?void 0:C.source}}};const K=["SessionsView","BookmarksView","HistoryView","Collapsed","FloatMode","RightPosition"];export{a as BookmarksView,n as Collapsed,r as FloatMode,i as HistoryView,l as RightPosition,t as SessionsView,K as __namedExportsOrder,J as default};
