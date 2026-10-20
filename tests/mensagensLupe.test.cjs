const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const contexto = vm.createContext({});
vm.runInContext(fs.readFileSync('src/services/mensagensLupe.js','utf8').replace(/^export /gm,''),contexto);

test('agradecimento entra na ordem correta sem criar mensagem de usuário',()=>{
  const conversa = {mensagens:[{papel:'usuario',texto:'Gere'},{papel:'lupe',texto:'Código'},{papel:'usuario',texto:'Obrigado'},{papel:'lupe',texto:'Disponha'}],avisos:[{id:'1',texto:'Recebemos!',aposMensagem:2}]};
  const itens = contexto.montarMensagensLupe(conversa);
  assert.equal(itens.map(i=>i.texto).join('|'),'Gere|Código|Recebemos!|Obrigado|Disponha');
  assert.equal(itens[2].papel,'lupe');
  assert.equal(conversa.mensagens.length,4);
});
test('conversa apenas com agradecimento não precisa de pergunta falsa',()=>{
  const itens = contexto.montarMensagensLupe({mensagens:[],avisos:[{id:'1',texto:'Recebemos!',aposMensagem:0}]});
  assert.equal(itens.length,1);assert.equal(itens[0].papel,'lupe');
});
