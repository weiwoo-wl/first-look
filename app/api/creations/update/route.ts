import { currentUser, sameOrigin } from "../../../lib/auth";

export async function PATCH(request: Request) {
  if (!sameOrigin(request)) return Response.json({ error: "请求来源无效" }, { status: 403 });
  if (!await currentUser(request)) return Response.json({ error: "请先登录" }, { status: 401 });
  return Response.json({ error: "产品发布后即成为不可修改的记录" }, { status: 409 });
}
