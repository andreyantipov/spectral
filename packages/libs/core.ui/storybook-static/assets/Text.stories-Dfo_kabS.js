import{s as S,c as b,D as _}from"./iframe-oJHCjMSb.js";import{s as C}from"./sva-yFf2R5f0.js";import"./preload-helper-Dp1pzeXC.js";const T=C({slots:["root"],base:{root:{fontFamily:"body",color:"fg.primary"}},variants:{variant:{heading:{root:{fontWeight:"bold",letterSpacing:"-0.02em"}},body:{root:{fontWeight:"normal"}},caption:{root:{color:"fg.muted",fontSize:"13px"}},mono:{root:{fontFamily:"mono",fontSize:"13px"}}},size:{xs:{root:{fontSize:"12px"}},sm:{root:{fontSize:"14px"}},md:{root:{fontSize:"16px"}},lg:{root:{fontSize:"20px"}},xl:{root:{fontSize:"24px"}},"2xl":{root:{fontSize:"32px"}}}},defaultVariants:{variant:"body",size:"md"}});function r(s){const[t,i]=S(s,["as","children","class"],["variant","size"]),z=T({variant:i.variant,size:i.size});return b(_,{get component(){return t.as??"span"},get class(){return`${z.root} ${t.class??""}`},get children(){return t.children}})}try{r.displayName="Text",r.__docgenInfo={description:"",displayName:"Text",props:{variant:{defaultValue:null,description:"",name:"variant",required:!1,type:{name:"enum",value:[{value:"undefined"},{value:'"heading"'},{value:'"body"'},{value:'"caption"'},{value:'"mono"'}]}},size:{defaultValue:null,description:"",name:"size",required:!1,type:{name:"enum",value:[{value:"undefined"},{value:'"sm"'},{value:'"md"'},{value:'"lg"'},{value:'"xs"'},{value:'"xl"'},{value:'"2xl"'}]}},as:{defaultValue:null,description:"",name:"as",required:!1,type:{name:"enum",value:[{value:"undefined"},{value:'"span"'},{value:'"p"'},{value:'"h1"'},{value:'"h2"'},{value:'"h3"'},{value:'"h4"'},{value:'"label"'}]}},class:{defaultValue:null,description:"",name:"class",required:!1,type:{name:"string | undefined"}}}}}catch{}const H={title:"Atoms/Text",component:r,argTypes:{variant:{control:"select",options:["heading","body","caption","mono"]},size:{control:"select",options:["xs","sm","md","lg","xl","2xl"]},as:{control:"select",options:["span","p","h1","h2","h3","h4","label"]}}},e={args:{variant:"body",children:"Body text"}},a={args:{variant:"heading",size:"xl",as:"h1",children:"Heading"}},n={args:{variant:"caption",children:"Caption text"}},o={args:{variant:"mono",children:"monospace text"}};var l,c,d;e.parameters={...e.parameters,docs:{...(l=e.parameters)==null?void 0:l.docs,source:{originalSource:`{
  args: {
    variant: "body",
    children: "Body text"
  }
}`,...(d=(c=e.parameters)==null?void 0:c.docs)==null?void 0:d.source}}};var p,u,m;a.parameters={...a.parameters,docs:{...(p=a.parameters)==null?void 0:p.docs,source:{originalSource:`{
  args: {
    variant: "heading",
    size: "xl",
    as: "h1",
    children: "Heading"
  }
}`,...(m=(u=a.parameters)==null?void 0:u.docs)==null?void 0:m.source}}};var v,g,f;n.parameters={...n.parameters,docs:{...(v=n.parameters)==null?void 0:v.docs,source:{originalSource:`{
  args: {
    variant: "caption",
    children: "Caption text"
  }
}`,...(f=(g=n.parameters)==null?void 0:g.docs)==null?void 0:f.source}}};var x,h,y;o.parameters={...o.parameters,docs:{...(x=o.parameters)==null?void 0:x.docs,source:{originalSource:`{
  args: {
    variant: "mono",
    children: "monospace text"
  }
}`,...(y=(h=o.parameters)==null?void 0:h.docs)==null?void 0:y.source}}};const $=["Body","Heading","Caption","Mono"];export{e as Body,n as Caption,a as Heading,o as Mono,$ as __namedExportsOrder,H as default};
