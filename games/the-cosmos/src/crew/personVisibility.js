export function personVisible(person) {
  if(!person?.loaded||!person.group?.parent)return false;
  for(let node=person.group;node;node=node.parent)if(!node.visible)return false;
  return true;
}
