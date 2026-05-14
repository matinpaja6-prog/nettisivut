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

          border-radius: 18px;

          padding: 12px 14px;

          border: 1px solid;

          box-shadow:
            0 14px 30px rgba(0, 0, 0, 0.18);

          overflow: hidden;
        }

        .own {
          background:
            linear-gradient(135deg, #ff9b24, #ff6b0a);
          border-color: rgba(255, 190, 118, 0.7);
          border-bottom-right-radius: 6px;
          color: #ffffff;
        }

        .other {
          background:
            linear-gradient(180deg, rgba(225, 239, 248, 0.98), rgba(190, 211, 225, 0.98));
          border-color: rgba(255, 255, 255, 0.56);
          border-bottom-left-radius: 6px;
          color: #071f34;
        }

        p {
          margin: 0;

          font-size: 15px;
          line-height: 1.5;

          color: inherit;
          font-weight: 750;

          padding: 2px 4px;
        }

        .message-image {
          width: 100%;
          max-width: 320px;

          display: block;

          border-radius: 16px;

          object-fit: cover;
        }
      `}</style>
    </div>
  );
}
