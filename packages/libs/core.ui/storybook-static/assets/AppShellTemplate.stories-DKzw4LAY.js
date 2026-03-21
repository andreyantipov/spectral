import{b as Y,l as F,o as G,d as P,j as l,c,m as A,D as Q,k as J,S as X,f as Z,t as o,g as C}from"./iframe-oJHCjMSb.js";import{C as ee}from"./CommandCenter-6n9bc-a0.js";import{N as te}from"./Notifications-DnVdQNA5.js";import{S as ne}from"./Sidebar-rB8-Tge6.js";import{s as oe}from"./sva-yFf2R5f0.js";import"./preload-helper-Dp1pzeXC.js";const ae=oe({slots:["root","content","page"],base:{root:{display:"flex",flexDirection:"row",height:"100%",width:"100%",bg:"bg.primary",overflow:"hidden",position:"relative"},content:{display:"flex",flexDirection:"column",flex:1,minWidth:0,height:"100%",bg:"bg.primary",position:"relative"},page:{display:"flex",flex:1,alignItems:"center",justifyContent:"center",overflow:"auto"}}});var se=o("<div><div><div>");const re=`
document.addEventListener('keydown', function(e) {
  if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
    e.preventDefault();
    window.__electrobunSendToHost({ type: 'shortcut', key: 'cmd+k' });
  }
  if (e.key === 'Escape') {
    window.__electrobunSendToHost({ type: 'shortcut', key: 'escape' });
  }
});
`;function g(n){const i=ae,[s,T]=Y(!1);let d,u;function I(){s()||T(!0)}function m(){s()&&T(!1)}function v(){s()?m():I()}function M(){var e,t;I(),(t=(e=n.sidebar).onNewTab)==null||t.call(e)}function V(e){var t,r;m(),(r=(t=n.commandCenter).onSelect)==null||r.call(t,e)}function j(e){var t,r;m(),(r=(t=n.commandCenter).onSubmitRaw)==null||r.call(t,e)}function z(e){const t=e.detail;(t==null?void 0:t.type)==="shortcut"&&(t.key==="cmd+k"?v():t.key==="escape"&&s()&&m())}function $(e){e.metaKey&&e.key==="k"&&(e.preventDefault(),v()),e.key==="Escape"&&s()&&m()}F(()=>{document.addEventListener("keydown",$);const e=window.__ipcBridge;e&&(u=e.subscribe(t=>{t.type==="toggle-command-center"&&v()}))}),G(()=>{document.removeEventListener("keydown",$),u==null||u()});function x(e){d=e,d.on("host-message",z),d.addMaskSelector("[data-command-center-overlay]")}return P(()=>{s(),requestAnimationFrame(()=>{document.querySelectorAll("electrobun-webview").forEach(e=>{e.syncDimensions(!0)})})}),P(()=>{const e=n.currentUrl;d&&e&&e!=="about:blank"&&d.loadURL(e)}),(()=>{var e=se(),t=e.firstChild,r=t.firstChild;return l(e,c(ne,A(()=>n.sidebar,{onNewTab:M})),t),l(r,c(X,{get when(){return J(()=>!!n.currentUrl)()&&n.currentUrl!=="about:blank"},get children(){return c(Q,{component:"electrobun-webview",ref(a){var p=x;typeof p=="function"?p(a):x=a},get src(){return n.currentUrl},preload:re,get style(){return`width: 100%; height: 100%; display: block; background: ${s()?"transparent":"#fff"}; border-radius: ${s()?"8px":"0"};`}})}}),null),l(r,()=>n.children,null),l(t,c(ee,A(()=>n.commandCenter,{get open(){return s()},get initialQuery(){return n.currentUrl},onClose:m,onSelect:V,onSubmitRaw:j})),null),l(e,c(te,{placement:"bottom-end"}),null),Z(a=>{var p=i().root,D=i().content,E=i().page;return p!==a.e&&C(e,a.e=p),D!==a.t&&C(t,a.t=D),E!==a.a&&C(r,a.a=E),a},{e:void 0,t:void 0,a:void 0}),e})()}try{g.displayName="AppShellTemplate",g.__docgenInfo={description:"",displayName:"AppShellTemplate",props:{sidebar:{defaultValue:null,description:"",name:"sidebar",required:!0,type:{name:"SidebarProps"}},commandCenter:{defaultValue:null,description:"",name:"commandCenter",required:!0,type:{name:'Omit<CommandCenterProps, "open" | "onClose">'}},currentUrl:{defaultValue:null,description:"",name:"currentUrl",required:!1,type:{name:"string | undefined"}}}}}catch{}var ie=o("<span>&#9776;"),h=o("<span>&#9734;"),le=o("<span>&#8634;"),ce=o("<span style=color:#f00>&#9679;"),me=o("<span style=color:#f80>&#9679;"),de=o("<span style=color:#888>&#9679;"),pe=o("<span style=color:#f00;font-size:12px>&#9679;"),ue=o("<span style=color:#f80;font-size:12px>&#9679;"),be=o("<span>+"),fe=o("<span>&#128465;"),ye=o("<div style=height:600px;width:100%;display:flex>"),B=o("<span style=color:#555;font-family:monospace>Page Content"),he=o("<span style=color:#555;font-family:monospace>Page Content (press Cmd+K to open command center)"),ge=o("<div style=height:600px;width:100%;display:flex;position:relative>");const w={sessions:()=>ie(),bookmarks:()=>h(),history:()=>le()},k=[{id:"sessions",icon:w.sessions(),label:"Sessions"},{id:"bookmarks",icon:w.bookmarks(),label:"Bookmarks"},{id:"history",icon:w.history(),label:"History"}],_=[{id:"yt",icon:ce(),label:"YouTube — youtube.com"},{id:"welcome",icon:me(),label:"Welcome!"},{id:"wiki",icon:de(),label:"Wikipedia — wikipedia.org"}],S=[{id:"yt",icon:pe(),label:"YouTube",secondaryLabel:"— youtube.com",section:"// open_tabs",badge:"Switch to Tab"},{id:"welcome",icon:ue(),label:"Welcome!",section:"// open_tabs"},{id:"gh",icon:h(),label:"GitHub",secondaryLabel:"— github.com",section:"// bookmarks"},{id:"so",icon:h(),label:"Stack Overflow",secondaryLabel:"— stackoverflow.com",section:"// bookmarks"},{id:"new-tab",icon:be(),label:"New Tab",section:"// commands"},{id:"bookmark",icon:h(),label:"Bookmark Current Page",section:"// commands"},{id:"clear-history",icon:fe(),label:"Clear Browsing History",section:"// commands"}],Te={title:"Templates/AppShellTemplate",component:g,decorators:[n=>(()=>{var i=ye();return l(i,c(n,{})),i})()]},b={args:{sidebar:{tabs:k,activeTabId:"sessions",items:_,activeItemId:"yt"},commandCenter:{items:S},children:B()}},f={render:()=>(()=>{var n=ge();return l(n,c(g,{sidebar:{tabs:k,activeTabId:"sessions",items:_,activeItemId:"yt"},commandCenter:{items:S,onSelect:i=>{}},get children(){return he()}})),n})()},y={args:{sidebar:{tabs:k,activeTabId:"sessions",items:_,collapsed:!0},commandCenter:{items:S},children:B()}};var N,O,L;b.parameters={...b.parameters,docs:{...(N=b.parameters)==null?void 0:N.docs,source:{originalSource:`{
  args: {
    sidebar: {
      tabs: defaultTabs,
      activeTabId: "sessions",
      items: sessionItems,
      activeItemId: "yt"
    },
    commandCenter: {
      items: commandCenterItems
    },
    children: <span style={{
      color: "#555",
      "font-family": "monospace"
    }}>Page Content</span>
  }
}`,...(L=(O=b.parameters)==null?void 0:O.docs)==null?void 0:L.source}}};var R,U,H;f.parameters={...f.parameters,docs:{...(R=f.parameters)==null?void 0:R.docs,source:{originalSource:`{
  render: () => <div style={{
    height: "600px",
    width: "100%",
    display: "flex",
    position: "relative"
  }}>
            <AppShellTemplate sidebar={{
      tabs: defaultTabs,
      activeTabId: "sessions",
      items: sessionItems,
      activeItemId: "yt"
    }} commandCenter={{
      items: commandCenterItems,
      onSelect: _id => {}
    }}>
                <span style={{
        color: "#555",
        "font-family": "monospace"
      }}>
                    Page Content (press Cmd+K to open command center)
                </span>
            </AppShellTemplate>
        </div>
}`,...(H=(U=f.parameters)==null?void 0:U.docs)==null?void 0:H.source}}};var W,K,q;y.parameters={...y.parameters,docs:{...(W=y.parameters)==null?void 0:W.docs,source:{originalSource:`{
  args: {
    sidebar: {
      tabs: defaultTabs,
      activeTabId: "sessions",
      items: sessionItems,
      collapsed: true
    },
    commandCenter: {
      items: commandCenterItems
    },
    children: <span style={{
      color: "#555",
      "font-family": "monospace"
    }}>Page Content</span>
  }
}`,...(q=(K=y.parameters)==null?void 0:K.docs)==null?void 0:q.source}}};const Ie=["Default","WithCommandCenterOpen","CollapsedSidebar"];export{y as CollapsedSidebar,b as Default,f as WithCommandCenterOpen,Ie as __namedExportsOrder,Te as default};
