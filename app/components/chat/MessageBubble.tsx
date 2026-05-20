type Props = {
  content?: string;
  image?: string;
  own?: boolean;
};

export default function MessageBubble({
  content,
  image,
  own
}: Props) {
  return (
    <div className={`row ${own ? "own-row" : ""}`}>
      <div className={own ? "own" : "other"}>
        {image && (
          <img
            src={image}
            alt=""
            className="message-image"
          />
        )}

        {content && (
          <p>{content}</p>
        )}
      </div>

      <style jsx>{`
        .row {
          display: flex;
          margin-bottom: 0;
        }

        .own-row {
          justify-content: flex-end;
        }

        .own,
        .other {
          max-width: 360px;

          border-radius: 14px;

          padding: 10px 13px;

          border: 1px solid;

          box-shadow: none;

          overflow: hidden;
        }

        .own {
          background: #ff7a1a;
          border-color: #ff7a1a;
          border-bottom-right-radius: 5px;
          color: #ffffff;
        }

        .other {
          background: #ffffff;
          border-color: #e2e8f0;
          border-bottom-left-radius: 5px;
          color: #0f172a;
        }

        p {
          margin: 0;

          font-size: 15px;
          line-height: 1.5;

          color: inherit;
          font-weight: 650;

          padding: 2px 4px;
        }

        .message-image {
          width: 100%;
          max-width: 320px;

          display: block;

          border-radius: 12px;

          object-fit: cover;
        }
      `}</style>
    </div>
  );
}
