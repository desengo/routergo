import { useState } from "react";
import { supabase } from "../lib/supabase";

export default function DriverLogin() {

  const [mode,setMode] = useState<"login"|"signup">("login")

  const [email,setEmail] = useState("")
  const [password,setPassword] = useState("")
  const [name,setName] = useState("")
  const [plate,setPlate] = useState("")

  const [loading,setLoading] = useState(false)

  async function login(){

    if(!email || !password){
      alert("Preencha email e senha")
      return
    }

    setLoading(true)

    const {error} = await supabase.auth.signInWithPassword({
      email,
      password
    })

    if(error){
      alert(error.message)
      setLoading(false)
      return
    }

    window.location.href="/driver"

  }

  async function signup(){

    if(!email || !password || !name || !plate){
      alert("Preencha todos os campos")
      return
    }

    setLoading(true)

    const {data,error} = await supabase.auth.signUp({
      email,
      password
    })

    if(error){
      alert(error.message)
      setLoading(false)
      return
    }

    const userId = data.user?.id

    if(!userId){
      alert("Erro ao criar usuário")
      setLoading(false)
      return
    }

    const {error:profileError} = await supabase
      .from("profiles")
      .upsert({
        id:userId,
        role:"driver",
        display_name:name,
        vehicle_plate:plate,
        driver_status:"offline"
      })

    if(profileError){
      alert(profileError.message)
      setLoading(false)
      return
    }

    alert("Conta criada com sucesso")

    window.location.href="/driver"

  }

  return(

    <div className="wrap">

      <div className="card">

        <h2>RouterGo Entregador</h2>

        {mode==="login" && (
          <>
            <label>Email</label>
            <input
              value={email}
              onChange={(e)=>setEmail(e.target.value)}
            />

            <label>Senha</label>
            <input
              type="password"
              value={password}
              onChange={(e)=>setPassword(e.target.value)}
            />

            <div className="row" style={{marginTop:16,gap:10}}>
              <button
                className="primary"
                onClick={login}
                disabled={loading}
              >
                Entrar
              </button>

              <button
                className="ghost"
                onClick={()=>setMode("signup")}
              >
                Criar conta
              </button>
            </div>
          </>
        )}

        {mode==="signup" && (
          <>
            <label>Nome</label>
            <input
              value={name}
              onChange={(e)=>setName(e.target.value)}
            />

            <label>Placa do veículo</label>
            <input
              value={plate}
              onChange={(e)=>setPlate(e.target.value)}
            />

            <label>Email</label>
            <input
              value={email}
              onChange={(e)=>setEmail(e.target.value)}
            />

            <label>Senha</label>
            <input
              type="password"
              value={password}
              onChange={(e)=>setPassword(e.target.value)}
            />

            <div className="row" style={{marginTop:16,gap:10}}>
              <button
                className="primary"
                onClick={signup}
                disabled={loading}
              >
                Criar conta
              </button>

              <button
                className="ghost"
                onClick={()=>setMode("login")}
              >
                Voltar
              </button>
            </div>
          </>
        )}

      </div>

    </div>

  )

}