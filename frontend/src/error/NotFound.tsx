import { Link } from 'react-router-dom'
import './styles/notfound.css'
interface INotFoundProps  {
    message? : string,
    backlink? : string,
    back_message? : string

}
const NotFound = (props : INotFoundProps) => (
    <main className="notfound-main">
        <div className="notfound-code">404</div>
        <h2>Page not found</h2>
        <p>{props.message ?? "The page you're looking for doesn't exist."}</p>
        <Link to={props.backlink ?? "/"}>{props.back_message ?? "Go home"}</Link>
    </main>
)

export default NotFound
