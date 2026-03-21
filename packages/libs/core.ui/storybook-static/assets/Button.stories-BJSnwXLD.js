import{s as C,a as O,m as G,t as I}from"./iframe-oJHCjMSb.js";import{s as N}from"./sva-yFf2R5f0.js";import"./preload-helper-Dp1pzeXC.js";const P=N({slots:["root"],base:{root:{display:"inline-flex",alignItems:"center",justifyContent:"center",fontFamily:"body",fontWeight:"medium",cursor:"pointer",borderRadius:"md",transition:"all 0.15s ease",border:"1px solid transparent",outline:"none",_disabled:{opacity:.5,cursor:"not-allowed"}}},variants:{variant:{solid:{root:{bg:"accent",color:"fg.primary",_hover:{bg:"accent.hover"},_active:{bg:"accent.active"}}},outline:{root:{bg:"transparent",color:"fg.primary",borderColor:"border",_hover:{borderColor:"border.hover",bg:"bg.secondary"}}},ghost:{root:{bg:"transparent",color:"fg.secondary",_hover:{bg:"bg.secondary",color:"fg.primary"}}}},size:{sm:{root:{height:"32px",px:"12px",fontSize:"13px"}},md:{root:{height:"38px",px:"16px",fontSize:"14px"}},lg:{root:{height:"44px",px:"20px",fontSize:"15px"}}}},defaultVariants:{variant:"solid",size:"md"}});var j=I("<button>");function i(l){const[n,V]=C(l,["variant","size","class"]),q=P({variant:n.variant,size:n.size});return(()=>{var d=j();return O(d,G({get class(){return`${q.root} ${n.class??""}`}},V),!1,!1),d})()}try{i.displayName="Button",i.__docgenInfo={description:"",displayName:"Button",props:{variant:{defaultValue:null,description:"",name:"variant",required:!1,type:{name:"enum",value:[{value:"undefined"},{value:'"solid"'},{value:'"outline"'},{value:'"ghost"'}]}},size:{defaultValue:null,description:"",name:"size",required:!1,type:{name:"enum",value:[{value:"undefined"},{value:'"sm"'},{value:'"md"'},{value:'"lg"'}]}},class:{defaultValue:null,description:"",name:"class",required:!1,type:{name:"string | undefined"}}}}}catch{}const F={title:"Atoms/Button",component:i,argTypes:{variant:{control:"select",options:["solid","outline","ghost"]},size:{control:"select",options:["sm","md","lg"]}}},e={args:{variant:"solid",size:"md",children:"Button"}},r={args:{variant:"outline",size:"md",children:"Button"}},a={args:{variant:"ghost",size:"md",children:"Button"}},s={args:{variant:"solid",size:"sm",children:"Small"}},t={args:{variant:"solid",size:"lg",children:"Large"}},o={args:{variant:"solid",children:"Disabled",disabled:!0}};var c,u,m;e.parameters={...e.parameters,docs:{...(c=e.parameters)==null?void 0:c.docs,source:{originalSource:`{
  args: {
    variant: "solid",
    size: "md",
    children: "Button"
  }
}`,...(m=(u=e.parameters)==null?void 0:u.docs)==null?void 0:m.source}}};var p,g,v;r.parameters={...r.parameters,docs:{...(p=r.parameters)==null?void 0:p.docs,source:{originalSource:`{
  args: {
    variant: "outline",
    size: "md",
    children: "Button"
  }
}`,...(v=(g=r.parameters)==null?void 0:g.docs)==null?void 0:v.source}}};var h,f,b;a.parameters={...a.parameters,docs:{...(h=a.parameters)==null?void 0:h.docs,source:{originalSource:`{
  args: {
    variant: "ghost",
    size: "md",
    children: "Button"
  }
}`,...(b=(f=a.parameters)==null?void 0:f.docs)==null?void 0:b.source}}};var z,y,_;s.parameters={...s.parameters,docs:{...(z=s.parameters)==null?void 0:z.docs,source:{originalSource:`{
  args: {
    variant: "solid",
    size: "sm",
    children: "Small"
  }
}`,...(_=(y=s.parameters)==null?void 0:y.docs)==null?void 0:_.source}}};var x,S,B;t.parameters={...t.parameters,docs:{...(x=t.parameters)==null?void 0:x.docs,source:{originalSource:`{
  args: {
    variant: "solid",
    size: "lg",
    children: "Large"
  }
}`,...(B=(S=t.parameters)==null?void 0:S.docs)==null?void 0:B.source}}};var $,D,L;o.parameters={...o.parameters,docs:{...($=o.parameters)==null?void 0:$.docs,source:{originalSource:`{
  args: {
    variant: "solid",
    children: "Disabled",
    disabled: true
  }
}`,...(L=(D=o.parameters)==null?void 0:D.docs)==null?void 0:L.source}}};const R=["Solid","Outline","Ghost","Small","Large","Disabled"];export{o as Disabled,a as Ghost,t as Large,r as Outline,s as Small,e as Solid,R as __namedExportsOrder,F as default};
